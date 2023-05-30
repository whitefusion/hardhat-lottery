import { run } from 'hardhat';

const verify = async (contractAddress: string, args: any[]) => {
  console.log('verifying contract ...');
  try {
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: args
    });
  } catch(e: any) {
    if (e.message.toLowerCase().includes('already verified')) {
      console.log('already verified');
    } else {
      console.log(e);
    }
  }
}

export default verify;
