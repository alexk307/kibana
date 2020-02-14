import { GlobalState } from '../../types';

export const whitelistSelector = (state: GlobalState) => state.whitelist.selectedAttributes;
