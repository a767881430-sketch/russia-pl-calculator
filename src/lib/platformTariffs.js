const EMPTY_PLATFORM_TARIFFS = {
  generatedAt: "",
  sources: {},
  ozon: {
    priceBuckets: [0, 100.01, 300.01, 1500.01, 5000.01, 10000.01],
    rfbsPriceBuckets: [0, 1500.01, 5000.01, 10000.01],
    lastMileRate: 0,
    lastMileMin: 25,
    lastMileMax: 25,
    commissions: [],
    freight: { volumeBands: [], clusters: [], rows: [] },
    nonLocal: [],
    clusters: [],
  },
  wb: {
    commissions: [],
    localization: [],
    volumeRates: [],
  },
  yandex: {
    paymentFrequencies: [
      ["每月一次", 0.013],
      ["每两周一次", 0.019],
      ["每周一次", 0.022],
      ["每天", 0.027],
    ],
    commissions: [],
  },
};

const LOADED_PLATFORM_TARIFFS = globalThis.__PLATFORM_TARIFFS__ || globalThis.window?.__PLATFORM_TARIFFS__;

export const PLATFORM_TARIFFS = LOADED_PLATFORM_TARIFFS || EMPTY_PLATFORM_TARIFFS;
export const PLATFORM_TARIFFS_LOADED = !!LOADED_PLATFORM_TARIFFS;
