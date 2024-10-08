import { FC } from 'react';
import tw from 'twin.macro';
import { ITelegramWalletFlow } from '.';
import { IStandardStyle, useUnifiedWalletContext } from '../../../contexts/UnifiedWalletContext';
import { TokenList } from './components/TokenList';

const styles: IStandardStyle = {
  walletButton: {
    light: [tw`bg-black text-white hover:bg-black/80`],
    dark: [tw`bg-white/10 hover:bg-white/20 border border-white/10 shadow-lg`],
    jupiter: [tw`bg-white/5 hover:bg-white/20 border border-white/10 shadow-lg`],
  },
};

export const TokenListPage: FC<{
  setSelectedToken: (selectedToken: any | undefined) => void;
  setFlow: (flow: ITelegramWalletFlow) => void;
}> = ({ setFlow, setSelectedToken }) => {
  const { theme } = useUnifiedWalletContext();

  return (
    <div tw="flex flex-col ">
      <TokenList
        setFlow={setFlow}
        showPrices={false}
        showSummary={false}
        setSelectedToken={setSelectedToken}
        showSearchBar={true}
      />
      <button
        type="button"
        onClick={() => {
          setFlow('Main');
        }}
        css={[
          tw`text-white font-semibold text-base w-full rounded-lg border border-white/10 p-4 leading-none`,
          styles.walletButton[theme],
        ]}
      >
        {`Back`}
      </button>
    </div>
  );
};
