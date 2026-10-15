// Estado compartilhado entre todas as telas.
export const emptyClosing = () => ({ step: 1, date: '', values: {}, moneyExpected: '', moneyReceived: '', causes: {}, operators: {} });

export const state = {
  user: null, posts: [], postId: null, companies: [], machines: [], operators: [],
  page: 'dashboard', operatorsEnabled: true,
  machineEditId: null, operatorEditId: null, companyEditId: null,
  historyFilter: 'Todos', historyFrom: '', historyTo: '', historyData: [], dashboardData: null,
  detailId: null, detailData: null, divergenceId: null, divergenceEditId: null, noteEditId: null,
  establishments: [], establishmentEditId: null, establishmentSearch: '',
  managers: [], managerEditId: null, managerDetailId: null, managerSearch: '',
  closing: emptyClosing(),
};
