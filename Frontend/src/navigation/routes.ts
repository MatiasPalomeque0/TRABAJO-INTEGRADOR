export const appRoutes = {
  customers: '/customers',
  newCustomer: '/customers/new',
  customerDetail: (id: number | string) => `/customers/${id}`,
  customerDevice: '/customers/[id]/device',
  newIntake: '/intakes/new',
  intakeDetail: (id: number | string) => `/intakes/${id}`,
  repairs: '/repairs',
  repairDetail: (id: number | string) => `/repairs/${id}`,
  repairDelivery: (id: number | string) => `/repairs/delivery/${id}`
} as const;
