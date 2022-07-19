const fs = require('fs')
const Caver = require('caver-js')
const caver = new Caver('https://api.baobab.klaytn.net:8651/')
const keystorePath = './keystore.json'
const erc721AbiPath = './erc721.abi'
const erc721BytecodePath = './erc721.bytecode'
const CaverExtKAS = require('caver-js-ext-kas');
const chainId = '1001';
const KASCred = require('./kas-cred.json')
const { createClient } = require('caver-js-ext-kas/src/utils/helper')
const accessKeyId = KASCred.accessKeyId
const secretAccessKey = KASCred.secretAccessKey
const caverKAS = new CaverExtKAS(chainId, accessKeyId, secretAccessKey, '', );

const erc721ContractAddr = '0xee468aEF23d782405770215dD2Cc2ccE190d6e80'
const kip17ContractAddr = '0x50AEd97606ed62f4E4FF41F72eBCcAfa746d2474'
const deployerAddr = '0x2da5cf382f950db077b7ab332471fa9496b94de4'
const walletUrl = "https://wallet-api.klaytnapi.com"

const tokenId = '2'
const myKASAccountAddress = '0x5CA2813f02B6adab098103cdBc17AfEf38291ec7'

async function getDeployerKeyring() {
    const keystore = fs.readFileSync(keystorePath, 'utf8')
    const password = await loadPassword()
    const deployerKeyring = caver.wallet.keyring.decrypt(keystore, password)
    caver.wallet.add(deployerKeyring)

    return deployerKeyring
}

async function deployERC721() {
    const deployerKeyring = await getDeployerKeyring()
    console.log('Addr', deployerKeyring.address)

    const abi = JSON.parse(fs.readFileSync(erc721AbiPath))
    const bytecode = fs.readFileSync(erc721BytecodePath)

    const contractInstance = caver.contract.create(abi)
    const deployedInstance = await contractInstance.deploy({
		from: deployerKeyring.address,
		gas: 15000000,
	}, bytecode)  
    console.log(`deployed address = ${deployedInstance.options.address}`)
}

async function deployKIP17() {
    const deployerKeyring = await getDeployerKeyring()
    console.log('Addr', deployerKeyring.address)

    const kip17 = await caver.kct.kip17.deploy({
            name:"TESTKIP17",
            symbol:"TST"
        }, deployerKeyring.address)

    console.log(kip17)
    console.log(kip17.address)
}

async function mintERC721() {
    const deployerKeyring = await getDeployerKeyring()
    console.log('Addr', deployerKeyring.address)

    const abi = JSON.parse(fs.readFileSync(erc721AbiPath))
    const contractInstance = caver.contract.create(abi, erc721ContractAddr)
    const r = await contractInstance.send({from:deployerKeyring.address, gas:10000000}, 'safeMint', myKASAccountAddress, tokenId)
    console.log(r)
}

async function getOwnershipERC721UsingKAS() {
    try {
        // This does not work if the contract is not deployed by KAS KIP-17 API.
        // const ret = await caverKAS.kas.kip17.getContract(erc721ContractAddr)
        // console.log(ret)

        // const ret = await caverKAS.kas.kip17.getTokenListByOwner(erc721ContractAddr, myKASAccountAddress)
        // console.log(ret)

        const contractInfo = await caverKAS.kas.tokenHistory.getNFTContract(erc721ContractAddr)
        console.log('contract info', contractInfo)

        // get owned NFTs using KAS API
        const query = {
            size: 1,
        }
        const result = await caverKAS.kas.tokenHistory.getNFTListByOwner(erc721ContractAddr, myKASAccountAddress, query)
        console.log(result)

    } catch(err) {
        console.log(err)
    }
}

async function getOwnershipERC721UsingCaver() {
    try {
        // get owned NFTs using caver with ERC-721 API
        const abi = JSON.parse(fs.readFileSync(erc721AbiPath))
        const contractInstance = caver.contract.create(abi, erc721ContractAddr)
        const balance = await contractInstance.call('balanceOf', myKASAccountAddress)

        console.log(`account address = ${myKASAccountAddress}`)
        for(var i = 0; i < balance; i++) {
            const tokenId = await contractInstance.call('tokenOfOwnerByIndex', myKASAccountAddress, i);
            console.log(`owned token id = ${tokenId}`)
        }

    } catch(err) {
        console.log(err)
    }
}

async function transferERC721() {
    const sender = myKASAccountAddress
    const owner = myKASAccountAddress
    const to = myKASAccountAddress
    
    try {
        const abi = JSON.parse(fs.readFileSync(erc721AbiPath))
        const contractInstance = caver.contract.create(abi, erc721ContractAddr)
        const tx = {
            from: myKASAccountAddress,
            to: erc721ContractAddr,
            value: 0,
            input: contractInstance.methods.safeTransferFrom(myKASAccountAddress, myKASAccountAddress, tokenId).encodeABI(),
            gas: 5000000,
            submit: true
        }
        const result = await caverKAS.kas.wallet.requestSmartContractExecution(tx)
        console.log(result)
    } catch(err) {
        console.log(err)
    }
}

async function getAccountList() {
    try {
        const query = {
            size: 10,
        }
        const {client, accessOptions} = createClient(walletUrl, chainId, accessKeyId, secretAccessKey)
        caverKAS.kas.wallet.accessOptions = accessOptions
        caverKAS.kas.wallet.client = client
        caverKAS.kas.wallet.client.defaultHeaders = {'x-krn':'krn:1001:wallet:f202bc70-c602-4b60-995f-4c1c58afb440:account-pool:test'}

        const res = await caverKAS.kas.wallet.getAccountList(query)
        console.log(res)
    } catch(err) {
        console.log(err)
    }

}


async function createKeystore() {
    var read = require('read')
    read({ prompt: 'Password: ', silent: true }, function(er, password) {
        const keyring = caver.wallet.keyring.generate()
        const keystore = keyring.encrypt(password)
        fs.writeFileSync(keystorePath, JSON.stringify(keystore), 'utf8')
    })
}

async function loadPassword() {
    var read = require('read')

    return new Promise((resolve, reject)=> {
        read({ prompt: 'Password: ', silent: true }, function(er, password) {
            if(er) {
                reject(er)
                return
            }
            resolve(password)
        })

    })

}

async function loadKeystore() {
    const keystore = fs.readFileSync(keystorePath, 'utf8')
    const password = await loadPassword()
    return caver.wallet.keyring.decrypt(keystore, password)
}

// Test a keystore to deploy a contract
// createKeystore()

getAccountList()

// Deploy ERC-721 token contract.
// deployERC721()

// Deploy KIP-17 token contract.
// deployKIP17()

// Mint a token using ERC-721
// mintERC721()

// get ownership of the NFT
// getOwnershipERC721UsingKAS()
// getOwnershipERC721UsingCaver()

// transfer ERC-721 token using wallet API
// transferERC721()