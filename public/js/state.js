// Estado compartilhado entre todas as telas.
export const emptyClosing = () => ({ step: 1, date: '', values: {}, moneyExpected: '', moneyReceived: '', causes: {}, operators: {} });

export const state = {
  user: null, posts: [], postId: null, companies: [], machines: [], operators: [], modules: [],
  page: 'dashboard', operatorsEnabled: true,
  machineEditId: null, operatorEditId: null, companyEditId: null,
  historyFilter: 'Todos', historyFrom: '', historyTo: '', historyData: [], dashboardData: null, networkSummary: null,
  detailId: null, detailData: null, divergenceId: null, divergenceEditId: null, noteEditId: null,
  // Área admin
  adminSummary: null,
  establishments: [], establishmentEditId: null, establishmentSearch: '', establishmentPage: 1,
  managers: [], managerEditId: null, managerDetailId: null, managerDetail: null, managerSearch: '', managerPage: 1, managerLinking: false,
  moduleEstablishmentId: null, moduleData: null,
  // Rede (módulo Multi-unidade)
  networkDays: 30, network: null, networkAlerts: [], networkUnit: '', networkSeverity: '', networkPostId: null, networkPost: null,
  closing: emptyClosing(),
};
