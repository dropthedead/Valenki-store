import buildBusketContainer from '../../components/basket/basket';
import { createHeader } from '../../components/header/header';
import {
  ElementParams,
  addInnerComponent,
  createElement,
} from '../../utils/general/baseComponent';

export default async function createBasketPage(): Promise<HTMLElement> {
  const basketParams: ElementParams<'div'> = {
    tag: 'div',
    classNames: ['basket-page'],
  };
  const basket = createElement(basketParams);
  const header = createHeader();
  const basketContainer = await buildBusketContainer();

  addInnerComponent(basket, header);
  addInnerComponent(basket, basketContainer);
  return basket;
}