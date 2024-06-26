import {
  createElement,
  addInnerComponent,
  clear,
  ElementParams,
} from '../../utils/general/baseComponent';
import { createHeader } from '../../components/header/header';
import { createProductCatalog } from '../../components/catalog/productCatalog/productCatalog';
import { createSortComponent } from '../../components/catalog/productSort/productSort';
import { fetchFilteredProducts, fetchProducts } from '../../api/apiService';
import { createPagination } from '../../components/catalog/pagination/pagination';
import {
  ProductProjection,
  ProductProjectionPagedQueryResponse,
} from '@commercetools/platform-sdk';
import {
  fetchAndMapCategories,
  getFiltersFromURL,
  updateURLWithFilters,
  buildCategoryPath,
  categoriesMap,
  Filters,
} from '../../components/catalog/filter/filters';
import {
  createFilterComponent,
  updateSizeFilterForCategory,
} from '../../components/catalog/filter/productFilter';
import { createLoadingOverlay } from '../../components/overlay/loadingOverlay';
import { generateBreadcrumbLinks } from '../../components/breadcrumbs/breadcrumbs';
import { RoutePaths } from '../../types/types';
import { appEvents } from '../../utils/general/eventEmitter';

export async function buildBreadcrumbsFromUrl(): Promise<
  { name: string; url: string }[]
> {
  const url = new URL(window.location.href);
  const categoryName = url.searchParams.get('category');

  const breadcrumbs = [
    { name: 'home', url: '/' },
    { name: 'catalog', url: RoutePaths.Catalog },
  ];
  if (!categoryName) {
    return breadcrumbs;
  }

  const categoryId = Object.keys(categoriesMap).find(
    (id) => categoriesMap[id].name === categoryName,
  );
  if (!categoryId) {
    return breadcrumbs;
  }

  const categoryPath = buildCategoryPath(categoryId);
  categoryPath.forEach((category) => {
    breadcrumbs.push({
      name: category.name,
      url: `/catalog?category=${category.name}`,
    });
  });

  return breadcrumbs;
}

export async function createCatalogPage(): Promise<HTMLElement> {
  await fetchAndMapCategories();

  const pageContainerParams: ElementParams<'div'> = {
    tag: 'div',
    classNames: ['catalog-page-container'],
  };
  const pageContainer = createElement(pageContainerParams);

  const breadcrumbContainerParams: ElementParams<'div'> = {
    tag: 'div',
    classNames: ['breadcrumb-wrapper'],
  };
  const breadcrumbContainer = createElement(breadcrumbContainerParams);

  const filterWrapperParams: ElementParams<'div'> = {
    tag: 'div',
    classNames: ['filter-wrapper'],
  };
  const filterIconContainerParams: ElementParams<'div'> = {
    tag: 'div',
    classNames: ['filter-icon-container'],
  };
  const filterWrapper = createElement(filterWrapperParams);
  const filterIconContainer = createElement(filterIconContainerParams);
  const filterIconParams: ElementParams<'img'> = {
    tag: 'img',
    classNames: ['filter-icon'],
    attributes: {
      src: '../assets/catalog/filtericon.png',
      alt: 'Filters Icon',
    },
  };

  const filterIcon = createElement(filterIconParams);
  addInnerComponent(filterIconContainer, filterIcon);

  const catalogContainerWrapperParams: ElementParams<'div'> = {
    tag: 'div',
    classNames: ['catalog-container-wrapper'],
  };
  const catalogContainerWrapper = createElement(catalogContainerWrapperParams);

  const catalogContainerParams: ElementParams<'section'> = {
    tag: 'section',
    classNames: ['catalog-container'],
  };
  const catalogContainer = createElement(catalogContainerParams);

  const paginationContainerParams: ElementParams<'div'> = {
    tag: 'div',
    classNames: ['pagination-container'],
  };
  const paginationContainer = createElement(paginationContainerParams);

  const header = createHeader();
  const filterComponent = await createFilterComponent();
  const loadingOverlay = createLoadingOverlay();

  const sortComponent = createSortComponent(async (sort: string) => {
    currentSort = sort;
    await renderProducts(1, itemsPerPage, currentSort);
  });

  const sortContainerParams: ElementParams<'div'> = {
    tag: 'div',
    classNames: ['sort-container'],
  };
  const sortContainer = createElement(sortContainerParams);
  addInnerComponent(sortContainer, sortComponent);

  let currentPage = 1;
  const itemsPerPage = 8;
  let currentSort = 'price asc';

  let filters = getFiltersFromURL();

  const updateSortAndFilterContainer = (): void => {
    if (window.innerWidth <= 800) {
      sortContainer.appendChild(filterIconContainer);
    } else {
      pageContainer.appendChild(filterIconContainer);
    }
  };

  updateSortAndFilterContainer();
  window.addEventListener('resize', updateSortAndFilterContainer);

  appEvents.on('displayProducts', async () => {
    filters = {
      audience: new Set(),
      category: '',
      size: new Set(),
    };
    await renderProducts(1, itemsPerPage, currentSort);
  });

  const updateBreadcrumbs = async (): Promise<void> => {
    const breadcrumbs = await buildBreadcrumbsFromUrl();
    const breadcrumbLinks = generateBreadcrumbLinks(breadcrumbs);
    clear(breadcrumbContainer);
    addInnerComponent(breadcrumbContainer, breadcrumbLinks);

    breadcrumbContainer.querySelectorAll('a').forEach((anchor) => {
      anchor.addEventListener('click', async (event: Event) => {
        event.preventDefault();
        const target = event.currentTarget as HTMLAnchorElement;
        const url = new URL(target.href);
        const params = new URLSearchParams(url.search);
        filters = {
          ...filters,
          category: params.get('category') || '',
        };
        if (filters.category) {
          const categoryId = Object.keys(categoriesMap).find(
            (id) => categoriesMap[id].name === filters.category,
          );
          if (categoryId) {
            filters.category = categoryId;
          }
        }
        updateURLWithFilters(filters);
        history.replaceState({}, '', url.toString());
        await updateBreadcrumbs();
        await renderProducts(1, itemsPerPage, currentSort);
      });
    });
  };

  const updateFilters = async (
    filterName: keyof Filters,
    value: string,
    checked: boolean,
  ): Promise<void> => {
    if (filterName === 'category') {
      filters.category = checked ? value : '';
      await updateSizeFilterForCategory(filters.category);
    } else {
      if (checked) {
        filters[filterName].add(value);
      } else {
        filters[filterName].delete(value);
      }
    }
    updateURLWithFilters(filters);
    await updateBreadcrumbs();
  };

  const showLoadingOverlay = (): void => {
    loadingOverlay.style.display = 'flex';
    paginationContainer.classList.remove('visible');
  };

  const hideLoadingOverlay = (): void => {
    loadingOverlay.style.display = 'none';
    paginationContainer.classList.add('visible');
  };

  const renderProducts = async (
    page: number,
    itemsPerPageCount: number,
    sort: string,
  ): Promise<void> => {
    showLoadingOverlay();
    clear(catalogContainer);

    const selectedFilters: string[] = [];

    const buildFilterString = (key: keyof Filters): string => {
      if (key === 'category') {
        return filters.category
          ? `categories.id: subtree("${filters.category}")`
          : '';
      } else if (filters[key].size > 0) {
        const values = Array.from(filters[key])
          .map((value) => `${value}`)
          .join(',');
        return `variants.attributes.${key}:${values}`;
      }
      return '';
    };

    const emptyRequestParams: ElementParams<'div'> = {
      tag: 'div',
      textContent:
        'Sorry, there are no results for your request. Please try another option 📭 ',
      classNames: ['empty-request'],
    };
    const emptyRequest = createElement(emptyRequestParams);

    const audienceFilter = buildFilterString('audience');
    const categoryFilter = buildFilterString('category');
    const sizeFilter = buildFilterString('size');

    if (audienceFilter) selectedFilters.push(audienceFilter);
    if (categoryFilter) selectedFilters.push(categoryFilter);
    if (sizeFilter) selectedFilters.push(sizeFilter);

    let products: ProductProjection[] = [];
    if (selectedFilters.length > 0) {
      products = await fetchFilteredProducts(selectedFilters, sort);
      if (products.length <= 0) {
        clear(catalogContainer);
        addInnerComponent(catalogContainer, emptyRequest);
        clear(paginationContainer);
      }
    } else {
      products = await fetchProducts(sort);
    }

    if (products.length > 0) {
      const start = (page - 1) * itemsPerPageCount;
      const end = start + itemsPerPageCount;
      const paginatedProducts = products.slice(start, end);

      const productCatalog = createProductCatalog(paginatedProducts);
      addInnerComponent(catalogContainer, productCatalog);

      const pagination = createPagination({
        totalItems: products.length,
        itemsPerPage: itemsPerPageCount,
        currentPage: page,
        onPageChange: (newPage) => {
          currentPage = newPage;
          renderProducts(currentPage, itemsPerPageCount, currentSort);
        },
      });

      clear(paginationContainer);
      addInnerComponent(paginationContainer, pagination);
    } else {
      clear(paginationContainer);
      addInnerComponent(catalogContainer, emptyRequest);
    }

    hideLoadingOverlay();
  };

  filterComponent.addEventListener('change', async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const filterName = target.classList[0].split('-')[0] as keyof Filters;

    await updateFilters(filterName, target.value, target.checked);
    clear(catalogContainer);
    await renderProducts(1, itemsPerPage, currentSort);
  });

  const initialBreadcrumbs = await buildBreadcrumbsFromUrl();
  const initialBreadcrumbLinks = generateBreadcrumbLinks(initialBreadcrumbs);
  addInnerComponent(breadcrumbContainer, initialBreadcrumbLinks);

  breadcrumbContainer.querySelectorAll('a').forEach((anchor) => {
    anchor.addEventListener('click', async (event: Event) => {
      event.preventDefault();
      const target = event.currentTarget as HTMLAnchorElement;
      const url = new URL(target.href);
      const params = new URLSearchParams(url.search);
      filters = {
        ...filters,
        category: params.get('category') || '',
      };
      if (filters.category) {
        const categoryId = Object.keys(categoriesMap).find(
          (id) => categoriesMap[id].name === filters.category,
        );
        if (categoryId) {
          filters.category = categoryId;
        }
      }
      updateURLWithFilters(filters);
      history.replaceState({}, '', url.toString());
      await updateBreadcrumbs();
      await renderProducts(1, itemsPerPage, currentSort);
    });
  });

  pageContainer.prepend(header);
  addInnerComponent(pageContainer, breadcrumbContainer);
  addInnerComponent(pageContainer, filterWrapper);
  addInnerComponent(filterWrapper, filterComponent);
  addInnerComponent(pageContainer, catalogContainerWrapper);
  addInnerComponent(catalogContainerWrapper, sortContainer);
  addInnerComponent(catalogContainerWrapper, catalogContainer);
  addInnerComponent(catalogContainerWrapper, paginationContainer);
  pageContainer.append(loadingOverlay);

  const filterContainer = filterWrapper.querySelector('.filter-container');
  filterIconContainer.addEventListener('click', (e) => {
    e.preventDefault();
    const catalogPage = document.querySelector('.catalog-page-container');
    filterContainer?.classList.toggle('open');
    catalogPage?.classList.toggle('hidden');
  });

  document.addEventListener('searchResults', (event) => {
    const customEvent = event as CustomEvent;
    const searchResults =
      customEvent.detail as ProductProjectionPagedQueryResponse;
    displaySearchResults(searchResults);
  });

  const displaySearchResults = (
    searchResults: ProductProjectionPagedQueryResponse,
  ): void => {
    const products = searchResults.results;
    clear(catalogContainer);

    if (products.length > 0) {
      const productCatalog = createProductCatalog(products);
      addInnerComponent(catalogContainer, productCatalog);

      const pagination = createPagination({
        totalItems: products.length,
        itemsPerPage: itemsPerPage,
        currentPage: currentPage,
        onPageChange: (newPage) => {
          currentPage = newPage;
          renderProducts(currentPage, itemsPerPage, currentSort);
        },
      });

      clear(paginationContainer);
      addInnerComponent(paginationContainer, pagination);
    } else {
      clear(paginationContainer);
      const noResultsMessage = createElement({
        tag: 'div',
        classNames: ['no-results-message'],
        textContent: 'No products found.',
      });
      addInnerComponent(catalogContainer, noResultsMessage);
    }
  };

  const setupFilterContainer = (): void => {
    if (window.innerWidth <= 800) {
      filterContainer?.addEventListener('click', handleFilterClick);
    } else {
      filterContainer?.removeEventListener('click', handleFilterClick);
    }
  };
  const handleFilterClick = (event: Event): void => {
    const catalogPage = document.querySelector('.catalog-page-container');
    const target = event.target as HTMLElement;
    if (target.classList.contains('filter-label')) {
      return;
    }
    if (target.tagName === 'LABEL') {
      if (target.closest('.checkbox-wrapper')) return;
      filterContainer?.classList.remove('open');
    }
    const parent = target.closest('.filter-group');
    const triangle = parent?.querySelector('.triangle');
    const radioContainer =
      parent?.querySelector('.radio-container') ||
      parent?.querySelector('.checkbox-container');
    triangle?.classList.toggle('open');
    radioContainer?.classList.toggle('hidden');
    if (catalogPage?.classList.contains('hidden')) {
      catalogPage.classList.remove('hidden');
    }
  };
  setupFilterContainer();
  window.addEventListener('resize', setupFilterContainer);

  await renderProducts(currentPage, itemsPerPage, currentSort);
  window.addEventListener('popstate', async () => {
    await updateBreadcrumbs();
    await renderProducts(currentPage, itemsPerPage, currentSort);
  });

  return pageContainer;
}