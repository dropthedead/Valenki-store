import { Cart } from '@commercetools/platform-sdk';
import {
  getActiveCart,
  applyPromoCode,
  getMappedDiscountCodes,
} from '../../../../api/apiService';
import {
  ElementParams,
  addInnerComponent,
  createElement,
} from '../../../../utils/general/baseComponent';
import { createInput } from '../../../../utils/general/createInput';
import createBasketPayInformation from './basketPayInformation';
import { updateSubtotalPriceUI, updateTotalPriceUI } from '../../basket-products/quantity-handlers';
import { getTotalPrice } from '../prices/getTotalPrice';
import { calculateSubtotal } from '../prices/getSubtotalPrice';
import { appEvents } from '../../../../utils/general/eventEmitter';

export default async function createBasketPayForm(): Promise<HTMLElement> {
  const basketPayFormParams: ElementParams<'form'> = {
    tag: 'form',
    classNames: ['basket-pay__basket-form'],
  };
  const basketPayForm = createElement(basketPayFormParams);

  const basketPayTitleParams: ElementParams<'h2'> = {
    tag: 'h2',
    classNames: ['basket-pay__basket-title'],
    textContent: 'Order Summary',
  };
  const basketPayTitle = createElement(basketPayTitleParams);

  const [basketDiscountLabel, basketDiscountInput] = createInput(
    'basket-discount',
    [
      ['basket-discount-label', 'label-basket'],
      ['basket-discount-input', 'input-basket'],
    ],
    'basket-discount',
    'basket-discount',
  );
  basketDiscountInput.setAttribute('placeholder', 'Code');
  basketDiscountLabel.textContent = 'Discount code / Promo code';

  const basketApplyButtonParams: ElementParams<'button'> = {
    tag: 'button',
    classNames: ['basket-form__apply-button'],
    textContent: 'Apply',
  };
  const basketApplyButton = createElement(basketApplyButtonParams);
  const errorSpanParams: ElementParams<'span'> = {
    tag: 'span',
    classNames: ['error-message'],
    textContent: '',
  };
  const errorSpan = createElement(errorSpanParams);
  const successSpanParams: ElementParams<'span'> = {
    tag: 'span',
    classNames: ['success-message'],
    textContent: '',
  };
  const successSpan = createElement(successSpanParams);

  addInnerComponent(basketDiscountLabel, basketDiscountInput);
  addInnerComponent(basketDiscountLabel, basketApplyButton);
  addInnerComponent(basketDiscountLabel, errorSpan);
  addInnerComponent(basketDiscountLabel, successSpan);

  let discountCodeText = '';
  let totalPrice = 0;
  let subtotal = 0;

  try {
    const cart = await getActiveCart();
    if (cart) {
      totalPrice = getTotalPrice(cart as Cart);
      subtotal = calculateSubtotal(cart);

      const discountCodesMap = await getMappedDiscountCodes();
      const discountCodeId = cart.discountCodes?.[0]?.discountCode?.id;

      if (discountCodeId) {
        discountCodeText = discountCodesMap[discountCodeId] ?? 'Unknown promo code';
      }
    }
  } catch (error) {
    console.error('Error fetching cart data:', error);
  }

  const basketPayInfContainer = createBasketPayInformation(
    totalPrice,
    subtotal,
    discountCodeText,
  );
  const basketPayButtonParams: ElementParams<'button'> = {
    tag: 'button',
    classNames: ['basket-form__submit-button'],
    textContent: 'Checkout',
    attributes: { disabled: '' },
  };
  const basketPayButton = createElement(basketPayButtonParams);

  addInnerComponent(basketPayForm, basketPayTitle);
  addInnerComponent(basketPayForm, basketDiscountLabel);
  addInnerComponent(basketPayForm, basketPayInfContainer);
  addInnerComponent(basketPayForm, basketPayButton);

  basketApplyButton.addEventListener('click', async (event: Event) => {
    event.preventDefault();
    errorSpan.style.display = 'none';
    successSpan.style.display = 'none';
    const discountCode = basketDiscountInput.value.trim();
    if (!discountCode) {
      errorSpan.textContent = 'Please enter a promo code';
      errorSpan.style.display = 'block';
      return;
    }
    try {
      const activeCart = await getActiveCart();
      if (activeCart) {
        const cartId = activeCart.id;
        const cartVersion = activeCart.version;
        if (activeCart.discountCodes && activeCart.discountCodes.length > 0) {
          errorSpan.textContent = 'Only one promo code allowed!';
          errorSpan.style.display = 'block';
          return;
        }
        const body = {
          version: cartVersion,
          actions: [
            {
              action: 'addDiscountCode' as const,
              code: discountCode,
            },
          ],
        };
        const response = await applyPromoCode(cartId, body);
        if (response && 'body' in response) {
          successSpan.textContent = 'Promo code applied successfully';
          successSpan.style.display = 'block';

          const discountCodesMap = await getMappedDiscountCodes();
          const appliedDiscountCode = discountCodesMap[response.body.discountCodes?.[0]?.discountCode?.id];

          const updatedCart = await getActiveCart();
          if (updatedCart) {
            subtotal = calculateSubtotal(updatedCart);
            totalPrice = getTotalPrice(updatedCart);
            updateSubtotalPriceUI(subtotal);
            updateTotalPriceUI(totalPrice);

            appEvents.emit('promoCodeApplied', { discountCode: appliedDiscountCode, totalPrice });
          }
        } else if (response && 'statusCode' in response && response.statusCode === 400) {
          errorSpan.textContent = 'Invalid promo code';
          errorSpan.style.display = 'block';
        }
      }
    } catch (error) {
      console.error('Error applying promo code:', error);
      errorSpan.textContent = 'Failed to apply promo code';
      errorSpan.style.display = 'block';
    }
  });

  return basketPayForm;
}
