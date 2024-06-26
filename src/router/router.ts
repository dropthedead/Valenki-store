import { createMainPage } from '../pages/MainPage/MainPage';
import { notFoundPage } from '../pages/NotFoundPage/NotFoundPage';
import { createAuthPage } from '../pages/AuthPage/AuthPage';
import { buildRegistrationPage } from '../pages/RegistrationPage/registrationPage';
import { createCatalogPage } from '../pages/CatalogPage/CatalogPage';
import { createDetailedProductPage } from '../pages/ProductDetailedPage/ProductDetailedPage';
import { buildUserProfilePage } from '../pages/UserProfilePage/userProfilePage';
import { createAboutUsPage } from '../pages/AboutUs/about';
import createBasketPage from '../pages/BasketPage/basketPage';
import { RoutePaths } from '../types/types';

type RouteHandler = (
  params?: Record<string, string>,
) => HTMLElement | Promise<HTMLElement>;
type Routes = Record<string, RouteHandler>;

interface Router {
  routes: Routes;
  handleLocationChange: () => void;
  navigate: (path: string) => void;
}

function matchPath(
  route: string,
  path: string,
): {
  params: Record<string, string>;
} | null {
  const routeSegments = route.split('/').filter(Boolean);
  const pathSegments = path.split('/').filter(Boolean);

  if (routeSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const pathSegment = pathSegments[i];

    if (routeSegment.startsWith(':')) {
      const paramName = routeSegment.slice(1);
      params[paramName] = pathSegment;
    } else if (routeSegment !== pathSegment) {
      return null;
    }
  }

  return { params };
}

function createRouter(routes: Routes): Router {
  const router: Router = {
    routes,
    async handleLocationChange() {
      const appElement = document.getElementById('app');
      const path = window.location.pathname;

      const isLoggedIn = Boolean(localStorage.getItem('token'));

      if (path === RoutePaths.Profile && !isLoggedIn) {
        this.navigate(RoutePaths.Login);
        return;
      }

      if (
        (path === RoutePaths.Login || path === RoutePaths.Register) &&
        isLoggedIn
      ) {
        this.navigate(RoutePaths.Main);
        return;
      }

      const routeKeys = Object.keys(this.routes);
      let handler: RouteHandler | null = null;
      let params: Record<string, string> = {};

      for (const route of routeKeys) {
        const match = matchPath(route, path);
        if (match) {
          handler = this.routes[route];
          params = match.params;
          break;
        }
      }

      if (!handler) {
        handler = notFoundPage;
      }

      const view = await handler(params);
      if (appElement) {
        appElement.innerHTML = '';
        appElement.appendChild(view);
      } else {
        console.error("The element with ID 'app' was not found in the DOM.");
      }
    },
    navigate(path: string) {
      window.history.pushState({}, '', path);
      this.handleLocationChange();
    },
  };

  window.addEventListener('popstate', () => {
    router.handleLocationChange();
  });

  return router;
}

const routes = {
  [RoutePaths.Main]: createMainPage,
  [RoutePaths.Login]: createAuthPage,
  [RoutePaths.Register]: buildRegistrationPage,
  [RoutePaths.NotFound]: notFoundPage,
  [RoutePaths.Catalog]: createCatalogPage,
  [RoutePaths.Profile]: buildUserProfilePage,
  [RoutePaths.Product]: createDetailedProductPage,
  [RoutePaths.AboutUs]: createAboutUsPage,
  [RoutePaths.Basket]: createBasketPage,
};

const router = createRouter(routes);

export function navigateTo(path: string): void {
  window.history.pushState({}, '', path);
  router.handleLocationChange();
}

export default router;
