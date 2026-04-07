export const APP_ROUTES = {
  home: '/',
  logicNeuron: '/logic-neuron',
  parityNumbers: '/parity-numbers',
  lettersAbc: '/letters-abc',
  lettersStyles: '/letters-styles',
  logicNetwork: '/logic-network',
  medicalSingle: '/medical-single',
  medicalMulti: '/medical-multi',
} as const

export type AppRouteKey = keyof typeof APP_ROUTES
