import React from 'react';
import ReactDOM from 'react-dom/client';
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib';
import { App } from './App';
import './style.css';
const root = createRootRoute({ component: App });
const routes = [
  createRoute({ getParentRoute: () => root, path: '/' }),
  createRoute({ getParentRoute: () => root, path: '/$page' }),
  createRoute({ getParentRoute: () => root, path: '/$page/$id' }),
];
const router = createRouter({
  routeTree: root.addChildren(routes),
  defaultNotFoundComponent: () => <p>Page not found</p>,
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
