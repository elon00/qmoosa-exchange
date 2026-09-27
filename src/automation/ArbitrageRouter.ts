export interface VenueQuote {
  venue: string;
  symbol: string;
  bid: number;
  ask: number;
  timestamp: number;
}

export interface ArbitrageOpportunity {
  symbol: string;
  buyVenue: string;
  buyPrice: number;
  sellVenue: string;
  sellPrice: number;
  spreadPercent: number;
  estimatedNetProfitUsdt: number;
  timestamp: number;
}

export class ArbitrageRouter {
  private quotes: Map<string, Map<string, VenueQuote>> = new Map(); // symbol -> venue -> VenueQuote

  public updateQuote(quote: VenueQuote): void {
    let venueMap = this.quotes.get(quote.symbol);
    if (!venueMap) {
      venueMap = new Map();
      this.quotes.set(quote.symbol, venueMap);
    }
    venueMap.set(quote.venue, quote);
  }

  public scanOpportunities(symbol: string, minSpreadPct = 0.3): ArbitrageOpportunity[] {
    const venueMap = this.quotes.get(symbol);
    if (!venueMap || venueMap.size < 2) return [];

    const venues = Array.from(venueMap.values());
    const opportunities: ArbitrageOpportunity[] = [];

    for (let i = 0; i < venues.length; i++) {
      for (let j = 0; j < venues.length; j++) {
        if (i === j) continue;
        const buyVenue = venues[i];
        const sellVenue = venues[j];

        // Buy at buyVenue ask, Sell at sellVenue bid
        if (sellVenue.bid > buyVenue.ask) {
          const spreadPct = ((sellVenue.bid - buyVenue.ask) / buyVenue.ask) * 100;
          if (spreadPct >= minSpreadPct) {
            opportunities.push({
              symbol,
              buyVenue: buyVenue.venue,
              buyPrice: buyVenue.ask,
              sellVenue: sellVenue.venue,
              sellPrice: sellVenue.bid,
              spreadPercent: Number(spreadPct.toFixed(3)),
              estimatedNetProfitUsdt: Number(((sellVenue.bid - buyVenue.ask) * 100).toFixed(2)), // for 100 units
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    return opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);
  }
}
