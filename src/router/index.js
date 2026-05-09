import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'inventory',
    component: () => import('../views/InventoryListView.vue')
  },
  {
    path: '/scan',
    name: 'scan',
    component: () => import('../views/ScannerView.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue')
  },
  {
    path: '/item/new',
    name: 'item-new',
    component: () => import('../views/ItemFormView.vue'),
    props: (r) => ({
      barcode: r.query.barcode ?? null,
      manual: r.query.manual === '1'
    })
  },
  {
    path: '/item/:id',
    name: 'item-detail',
    component: () => import('../views/ItemDetailView.vue'),
    props: (r) => ({ id: r.params.id })
  },
  {
    path: '/item/:id/edit',
    name: 'item-edit',
    component: () => import('../views/ItemFormView.vue'),
    props: (r) => ({ editId: r.params.id })
  }
];

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 };
  }
});
