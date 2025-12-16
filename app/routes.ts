import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/_index.tsx'),
  route('login', 'routes/login.tsx'),
  route('logout', 'routes/logout.tsx'), // Added logout
  { file: 'routes/home.tsx', path: 'home' },
] satisfies RouteConfig;
