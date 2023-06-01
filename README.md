# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```

部署步骤
1. 用自己的钱包地址订阅一个VRF获取subscriptionId并充LINK: https://vrf.chain.link/sepolia
2. 部署到测试网络sepolia并verify
3. 把合同地址添加到VRF的消费者
4. 把合同地址注册到automation的upkeeper: https://automation.chain.link/sepolia/77382476134946186655840133777300514539085262196769246620831077113234030902517
5. 跑staging test
