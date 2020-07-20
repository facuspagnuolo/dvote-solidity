PATH  := node_modules/.bin:$(PATH)
SHELL := /bin/bash

.DEFAULT_GOAL := help
SOLC=./node_modules/.bin/solcjs
TSC=./node_modules/.bin/tsc
CONTRACT_SOURCES=$(wildcard contracts/*.sol contracts/registry/*.sol contracts/resolver/*.sol)
ENS_REGISTRY_ARTIFACT_NAME=contracts_registry_ENSRegistry_sol_ENSRegistry
ENS_PUBLIC_RESOLVER_ARTIFACT_NAME=contracts_resolver_PublicResolver_sol_PublicResolver
VOTING_PROCESS_ARTIFACT_NAME=contracts_VotingProcess_sol_VotingProcess
OUTPUT_FILES=build/index.js build/ens-registry.json build/ens-public-resolver.json build/voting-process.json

###############################################################################
## HELP
###############################################################################

.PHONY: help
help:
	@echo "Available targets:"
	@echo
	@echo "  $$ make         Runs 'make help' by default"
	@echo "  $$ make help    Shows this text"
	@echo
	@echo "  $$ make all     Compile the smart contracts and types into 'build'"
	@echo "  $$ make test    Compile and test the contracts"
	@echo "  $$ make clean   Cleanup the build folder"
	@echo

###############################################################################
## RECIPES
###############################################################################

all: node_modules contract-output build/index.js

node_modules: package.json package-lock.json
	@echo Updating Node packages
	npm install || true
	if [ -d node_modules/web3-providers/node_modules/websocket ]; then \
	  rm -Rf node_modules/web3-providers/node_modules/websocket/.git ; \
	  rm -Rf node_modules/web3-providers-ws/node_modules/websocket/.git ; \
	fi
	@touch $@

contract-output: build/ens-registry.json build/ens-public-resolver.json build/voting-process.json

build:
	@mkdir -p build
	@touch $@

build/ens-registry.json: build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).abi build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).bin
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).bin)\"}" > $@

build/ens-public-resolver.json: build/solc/$(ENS_PUBLIC_RESOLVER_ARTIFACT_NAME).abi build/solc/$(ENS_PUBLIC_RESOLVER_ARTIFACT_NAME).bin
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(ENS_PUBLIC_RESOLVER_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(ENS_PUBLIC_RESOLVER_ARTIFACT_NAME).bin)\"}" > $@

build/voting-process.json: build/solc/$(VOTING_PROCESS_ARTIFACT_NAME).abi build/solc/$(VOTING_PROCESS_ARTIFACT_NAME).bin
	@echo "Building $@"
	echo "{\"abi\":$$(cat build/solc/$(VOTING_PROCESS_ARTIFACT_NAME).abi),\"bytecode\":\"0x$$(cat build/solc/$(VOTING_PROCESS_ARTIFACT_NAME).bin)\"}" > $@

build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).abi: build/solc
build/solc/$(ENS_REGISTRY_ARTIFACT_NAME).bin: build/solc
build/solc/$(ENS_PUBLIC_RESOLVER_ARTIFACT_NAME).abi: build/solc
build/solc/$(ENS_PUBLIC_RESOLVER_ARTIFACT_NAME).bin: build/solc
build/solc/$(VOTING_PROCESS_ARTIFACT_NAME).abi: build/solc
build/solc/$(VOTING_PROCESS_ARTIFACT_NAME).bin: build/solc

# Get openzeppelin contracts
contracts/openzeppelin: node_modules
	mkdir -p $@
	cp -a ./node_modules/@openzeppelin/contracts/* $@
	touch $@

# Intermediate solidity compiled artifacts
build/solc: $(CONTRACT_SOURCES) contracts/openzeppelin
	@echo "Building contracts"
	mkdir -p $@
	$(SOLC) --optimize --bin --abi -o $@ --base-path ${PWD}/contracts $(CONTRACT_SOURCES)
	@touch $@

# from $(OUTPUT_FILES)
build/index.js: build/ens-registry.json build/ens-public-resolver.json build/voting-process.json lib/index.ts
	cp lib/index.ts build
	$(TSC) --build tsconfig.json

test: clean all
	npm run test

clean: 
	rm -Rf ./build
	rm -Rf ./contracts/openzeppelin/*
