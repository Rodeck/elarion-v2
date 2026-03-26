import { registerHandler } from '../../websocket/dispatcher';
import {
  browseMarketplace,
  getItemListings,
  buyListing,
  listItem,
  cancelListing,
  getMyListings,
  collectCrownsHandler,
  collectItemsHandler,
} from './marketplace-service';

export function registerMarketplaceHandlers(): void {
  registerHandler('marketplace.browse', browseMarketplace);
  registerHandler('marketplace.item_listings', getItemListings);
  registerHandler('marketplace.buy', buyListing);
  registerHandler('marketplace.list_item', listItem);
  registerHandler('marketplace.cancel_listing', cancelListing);
  registerHandler('marketplace.my_listings', getMyListings);
  registerHandler('marketplace.collect_crowns', collectCrownsHandler);
  registerHandler('marketplace.collect_items', collectItemsHandler);
}
