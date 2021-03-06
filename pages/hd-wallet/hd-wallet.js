angular
  .module('app')
  .component('hdWalletPage', {
    templateUrl: 'pages/hd-wallet/hd-wallet.html',
    controller: HdWalletPageController,
    controllerAs: 'vm',
    bindings: {}
  });

var PBKDF2_SALT = 'Digital Bitbox',
  PBKDF2_HMACLEN = 64,
  PBKDF2_ROUNDS_APP = 20480;

var METHOD_NONE = 0,
  METHOD_PBKDF2 = 1,
  METHOD_COINOMI = 2;

function HdWalletPageController(lodash, bitcoinNetworks) {
  var vm = this;

  var BITCOIN = lodash.find(bitcoinNetworks, ['label', 'BTC (Bitcoin)']);
  var BITCOIN_TESTNET = lodash.find(bitcoinNetworks, ['label', 'BTC (Bitcoin Testnet)']);
  var PIVX = lodash.find(bitcoinNetworks, ['label', 'PIVX (PIVX)']);

  vm.coinTypes = bitcoinNetworks;
  vm.coinType = BITCOIN;
  vm.networks = bitcoinNetworks;
  vm.network = BITCOIN;
  vm.mnemonic = null;
  vm.asPassword = true;
  vm.passphrase = null;
  vm.seed = null;
  vm.seedHex = null;
  vm.node = null;
  vm.nodeBase58 = null;
  vm.privKeyWif = null;
  vm.publicKeyWif = null;
  vm.address = null;
  vm.account = 0;
  vm.change = 0;
  vm.index = 0;
  vm.path = 'm/44\'/0\'/0\'/0/0';
  vm.customPath = '0/0';
  vm.strenghteningMethods = [
    { label: 'BIP39 default (like Coinomi)', id: METHOD_COINOMI },
    { label: 'BIP39 custom (passhprase to hex)', id: METHOD_NONE },
    { label: 'PBKDF2 (Digital Bitbox)', id: METHOD_PBKDF2 }

  ];
  vm.strenghtening = vm.strenghteningMethods[0];
  vm.seedLengths = [
    { label: '128bit / 12 words', id: 128 },
    { label: '160bit / 15 words', id: 160 },
    { label: '192bit / 18 words', id: 192 },
    { label: '224bit / 21 words', id: 224 },
    { label: '256bit / 24 words', id: 256 }
  ];
  vm.mnemonicLength = vm.seedLengths[0];

  vm.$onInit = function () {
    vm.newSeed();
  };

  vm.newSeed = function () {
    vm.mnemonic = bitcoin.bip39.generateMnemonic(vm.mnemonicLength.id);
    vm.fromMnemonic();
  };

  vm.fromMnemonic = function () {
    var pw = null;
    if (vm.passphrase) {
      if (vm.strenghtening.id === METHOD_PBKDF2) {
        pw = bitcoin.pbkdf2.pbkdf2Sync(
          bitcoin.Buffer.from(vm.passphrase, 'utf8'),
          PBKDF2_SALT,
          PBKDF2_ROUNDS_APP,
          PBKDF2_HMACLEN,
          'sha512'
        ).toString('hex');
      } else if (vm.strenghtening.id === METHOD_COINOMI) {
        pw = vm.passphrase;
      } else {
        pw = bitcoin.Buffer.from(vm.passphrase, 'utf8').toString('hex');
      }
    }
    vm.seed = bitcoin.bip39.mnemonicToSeed(vm.mnemonic, pw);
    vm.fromSeed();
  };

  vm.fromSeed = function () {
    if (vm.seed) {
      vm.seedHex = vm.seed.toString('hex');

      vm.node = bitcoin.HDNode.fromSeedBuffer(vm.seed, vm.network.config);
      vm.nodeBase58 = vm.node.toBase58();
      vm.customParentBase58 = vm.node.toBase58();
      vm.fromNode();
      vm.fromCustomParent();
    }
  };

  vm.fromHexSeed = function () {
    vm.seed = bitcoin.Buffer.from(vm.seedHex, 'hex');
    vm.mnemonic = 'Cannot be reversed! Mnemonic to seed is a one way street...';
    vm.fromSeed();
  };

  vm.fromBase58Seed = function () {
    vm.error = null;
    try {
      vm.node = bitcoin.HDNode.fromBase58(vm.nodeBase58, vm.network.config);
      vm.seed = null;
      vm.seedHex = 'Cannot be reversed! Seed is hashed to create HD node';
      vm.mnemonic = 'Cannot be reversed! Mnemonic to seed is a one way street...';
      vm.fromNode();
    } catch (e) {
      vm.error = e;
    }
  };

  vm.fromNode = function () {
    vm.node.keyPair.network = vm.network.config;
    vm.privKeyWif = vm.node.keyPair.toWIF();
    vm.publicKeyWif = vm.node.neutered().toBase58();
    vm.address = vm.node.keyPair.getAddress();
    vm.calculatePath();
  };

  vm.calculatePath = function () {
    vm.path = 'm/44\'/' + vm.coinType.config.bip44 + '\'/' + vm.account + '\'/' + vm.change + '/' + vm.index;
    vm.fromPath();
  };

  vm.fromPath = function () {
    vm.derivedKey = vm.node.derivePath(vm.path);
    calculateAddresses(vm.derivedKey.keyPair, vm.network.config);
  };

  vm.fromCustomParent = function () {
    vm.customParentError = null;
    try {
      vm.customParent = bitcoin.HDNode.fromBase58(vm.customParentBase58, vm.network.config);
      vm.customPath = '0/0';
      vm.fromCustomPath();
    } catch (e) {
      vm.customParentError = e;
    }
  };

  vm.fromCustomPath = function () {
    var network = vm.network.config;
    vm.customDerivedKey = vm.customParent.derivePath(vm.customPath, network);
    calculateAddresses(vm.customDerivedKey.keyPair, network);
  };
}
