import React from 'react';
import {render, act} from '@testing-library/react-native';
import {NativeModules, Platform} from 'react-native';
import {
  ShopifyCheckoutSheetProvider,
  useShopifyCheckoutSheet,
} from '../src/context';
import {
  ApplePayContactField,
  ColorScheme,
  ShopifyCheckoutSheet,
  type Configuration,
} from '../src';

const checkoutUrl = 'https://shopify.com/checkout';
const config: Configuration = {
  colorScheme: ColorScheme.automatic,
};

const acceleratedCheckoutsConfig: Configuration = {
  ...config,
  acceleratedCheckouts: {
    storefrontDomain: 'test-shop.myshopify.com',
    storefrontAccessToken: 'shpat_test_token',
  },
};

jest.mock('react-native');

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

const HookTestComponent = ({
  onHookValue,
}: {
  onHookValue: (value: any) => void;
}) => {
  const hookValue = useShopifyCheckoutSheet();
  onHookValue(hookValue);
  return null;
};

const MockChild = () => null;

describe('ShopifyCheckoutSheetProvider', () => {
  const TestComponent = ({children}: {children: React.ReactNode}) => (
    <ShopifyCheckoutSheetProvider configuration={config}>
      {children}
    </ShopifyCheckoutSheetProvider>
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const component = render(
      <TestComponent>
        <MockChild />
      </TestComponent>,
    );

    expect(component).toBeTruthy();
  });

  it('creates ShopifyCheckoutSheet instance with configuration', () => {
    render(
      <TestComponent>
        <MockChild />
      </TestComponent>,
    );

    expect(
      NativeModules.ShopifyCheckoutSheetKit.setConfig,
    ).toHaveBeenCalledWith(config);
  });

  it('skips configuration when no configuration is provided', () => {
    render(
      <ShopifyCheckoutSheetProvider>
        <MockChild />
      </ShopifyCheckoutSheetProvider>,
    );

    expect(
      NativeModules.ShopifyCheckoutSheetKit.setConfig,
    ).not.toHaveBeenCalled();
    expect(
      NativeModules.ShopifyCheckoutSheetKit.configureAcceleratedCheckouts,
    ).not.toHaveBeenCalled();
  });

  it('configures accelerated checkouts when provided', async () => {
    (Platform as any).Version = '17.0';
    (
      NativeModules.ShopifyCheckoutSheetKit
        .configureAcceleratedCheckouts as unknown as {mockReturnValue: any}
    ).mockReturnValue(true);

    const configWithAccelerated: Configuration = {
      ...config,
      acceleratedCheckouts: {
        storefrontDomain: 'test-shop.myshopify.com',
        storefrontAccessToken: 'shpat_test_token',
        customer: {
          email: 'test@example.com',
          phoneNumber: '+123',
          accessToken: 'customer-access-token',
        },
        wallets: {
          applePay: {
            merchantIdentifier: 'merchant.test',
            contactFields: [ApplePayContactField.email],
          },
        },
      },
    };

    render(
      <ShopifyCheckoutSheetProvider configuration={configWithAccelerated}>
        <MockChild />
      </ShopifyCheckoutSheetProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      NativeModules.ShopifyCheckoutSheetKit.configureAcceleratedCheckouts,
    ).toHaveBeenCalledWith(
      'test-shop.myshopify.com',
      'shpat_test_token',
      'test@example.com',
      '+123',
      'customer-access-token',
      'merchant.test',
      ['email'],
      [],
    );
  });

  it('reuses the same instance across re-renders', () => {
    const {rerender} = render(
      <TestComponent>
        <MockChild />
      </TestComponent>,
    );

    rerender(
      <TestComponent>
        <MockChild />
      </TestComponent>,
    );

    expect(
      NativeModules.ShopifyCheckoutSheetKit.setConfig.mock.calls,
    ).toHaveLength(2);
  });

  it('applies a new configuration when the prop changes', async () => {
    const {rerender} = render(
      <ShopifyCheckoutSheetProvider configuration={config}>
        <MockChild />
      </ShopifyCheckoutSheetProvider>,
    );
    await flushEffects();

    const newConfig: Configuration = {colorScheme: ColorScheme.dark};
    rerender(
      <ShopifyCheckoutSheetProvider configuration={newConfig}>
        <MockChild />
      </ShopifyCheckoutSheetProvider>,
    );
    await flushEffects();

    expect(
      NativeModules.ShopifyCheckoutSheetKit.setConfig,
    ).toHaveBeenLastCalledWith(newConfig);
  });

  it('passes features through to the ShopifyCheckoutSheet instance', () => {
    (Platform as any).OS = 'android';
    // @ts-expect-error "eventEmitter is private"
    const eventEmitter = ShopifyCheckoutSheet.eventEmitter;

    try {
      render(
        <ShopifyCheckoutSheetProvider
          features={{handleGeolocationRequests: false}}>
          <MockChild />
        </ShopifyCheckoutSheetProvider>,
      );

      expect(eventEmitter.addListener).not.toHaveBeenCalledWith(
        'geolocationRequest',
        expect.any(Function),
      );
    } finally {
      (Platform as any).OS = 'ios';
    }
  });

  describe('acceleratedCheckoutsAvailable', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    beforeEach(() => {
      (Platform as any).Version = '17.0';
    });

    it('is false before configuration completes', async () => {
      render(
        <ShopifyCheckoutSheetProvider
          configuration={acceleratedCheckoutsConfig}>
          <HookTestComponent onHookValue={onHookValue} />
        </ShopifyCheckoutSheetProvider>,
      );

      expect(hookValue.acceleratedCheckoutsAvailable).toBe(false);
      await flushEffects();
    });

    it('becomes true once native reports accelerated checkouts ready', async () => {
      NativeModules.ShopifyCheckoutSheetKit.configureAcceleratedCheckouts.mockReturnValue(
        true,
      );

      render(
        <ShopifyCheckoutSheetProvider
          configuration={acceleratedCheckoutsConfig}>
          <HookTestComponent onHookValue={onHookValue} />
        </ShopifyCheckoutSheetProvider>,
      );
      await flushEffects();

      expect(hookValue.acceleratedCheckoutsAvailable).toBe(true);
    });

    it('stays false when native reports accelerated checkouts unavailable', async () => {
      NativeModules.ShopifyCheckoutSheetKit.configureAcceleratedCheckouts.mockReturnValue(
        false,
      );

      render(
        <ShopifyCheckoutSheetProvider
          configuration={acceleratedCheckoutsConfig}>
          <HookTestComponent onHookValue={onHookValue} />
        </ShopifyCheckoutSheetProvider>,
      );
      await flushEffects();

      expect(hookValue.acceleratedCheckoutsAvailable).toBe(false);
    });
  });

  describe('customer deprecation warning', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    const renderWithCustomer = async (
      customer: NonNullable<Configuration['acceleratedCheckouts']>['customer'],
    ) => {
      render(
        <ShopifyCheckoutSheetProvider
          configuration={{
            ...acceleratedCheckoutsConfig,
            acceleratedCheckouts: {
              ...acceleratedCheckoutsConfig.acceleratedCheckouts!,
              customer,
            },
          }}>
          <MockChild />
        </ShopifyCheckoutSheetProvider>,
      );
      await flushEffects();
    };

    it.each([
      ['email', {accessToken: 'token', email: 'test@example.com'}],
      ['phoneNumber', {accessToken: 'token', phoneNumber: '+123'}],
    ])('warns when accessToken is combined with %s', async (_, customer) => {
      await renderWithCustomer(customer);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('accessToken with contactFields'),
      );
    });

    it.each([
      ['accessToken only', {accessToken: 'token'}],
      ['email only', {email: 'test@example.com'}],
      ['no customer', undefined],
    ])('does not warn with %s', async (_, customer) => {
      await renderWithCustomer(customer);

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});

describe('useShopifyCheckoutSheet', () => {
  const Wrapper = ({children}: {children: React.ReactNode}) => (
    <ShopifyCheckoutSheetProvider configuration={config}>
      {children}
    </ShopifyCheckoutSheetProvider>
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('provides addEventListener function', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    expect(hookValue.addEventListener).toBeDefined();
    expect(typeof hookValue.addEventListener).toBe('function');
  });

  it('provides removeEventListeners function', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    act(() => {
      hookValue.removeEventListeners('close');
    });

    expect(hookValue.removeEventListeners).toBeDefined();
  });

  it('provides present function and calls it with checkoutUrl', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    act(() => {
      hookValue.present(checkoutUrl);
    });

    expect(NativeModules.ShopifyCheckoutSheetKit.present).toHaveBeenCalledWith(
      checkoutUrl,
    );
  });

  it('does not call present with empty checkoutUrl', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    act(() => {
      hookValue.present('');
    });

    expect(
      NativeModules.ShopifyCheckoutSheetKit.present,
    ).not.toHaveBeenCalled();
  });

  it('provides preload function and calls it with checkoutUrl', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    act(() => {
      hookValue.preload(checkoutUrl);
    });

    expect(NativeModules.ShopifyCheckoutSheetKit.preload).toHaveBeenCalledWith(
      checkoutUrl,
    );
  });

  it('does not call preload with empty checkoutUrl', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    act(() => {
      hookValue.preload('');
    });

    expect(
      NativeModules.ShopifyCheckoutSheetKit.preload,
    ).not.toHaveBeenCalled();
  });

  it('provides invalidate function', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    act(() => {
      hookValue.invalidate();
    });

    expect(
      NativeModules.ShopifyCheckoutSheetKit.invalidateCache,
    ).toHaveBeenCalled();
  });

  it('provides dismiss function', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    act(() => {
      hookValue.dismiss();
    });

    expect(NativeModules.ShopifyCheckoutSheetKit.dismiss).toHaveBeenCalled();
  });

  it('provides setConfig function', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    const newConfig = {colorScheme: ColorScheme.light};

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    act(() => {
      hookValue.setConfig(newConfig);
    });

    expect(
      NativeModules.ShopifyCheckoutSheetKit.setConfig,
    ).toHaveBeenCalledWith(newConfig);
  });

  it('provides getConfig function', async () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    const config = await hookValue.getConfig();
    expect(config).toEqual({
      preloading: true,
      colorScheme: 'automatic',
      logLevel: 'error',
    });

    expect(NativeModules.ShopifyCheckoutSheetKit.getConfig).toHaveBeenCalled();
  });

  it('provides version from the instance', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    expect(hookValue.version).toBe('0.7.0');
  });

  it('addEventListener returns subscription object', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    const subscription = hookValue.addEventListener('close', jest.fn());
    expect(subscription).toBeDefined();
    expect(subscription.remove).toBeDefined();
  });

  it('addEventListener invokes the callback when the event is emitted', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };
    // @ts-expect-error "eventEmitter is private"
    const eventEmitter = ShopifyCheckoutSheet.eventEmitter;

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    const callback = jest.fn();
    hookValue.addEventListener('close', callback);
    eventEmitter.emit('close');

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('removeEventListeners detaches previously added listeners', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };
    // @ts-expect-error "eventEmitter is private"
    const eventEmitter = ShopifyCheckoutSheet.eventEmitter;

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    const callback = jest.fn();
    hookValue.addEventListener('close', callback);
    hookValue.removeEventListeners('close');
    eventEmitter.emit('close');

    expect(eventEmitter.removeAllListeners).toHaveBeenCalledWith('close');
    expect(callback).not.toHaveBeenCalled();
  });

  it('setConfig resolves after forwarding the configuration', async () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    const newConfig = {colorScheme: ColorScheme.dark};
    await expect(hookValue.setConfig(newConfig)).resolves.toBeUndefined();
    expect(
      NativeModules.ShopifyCheckoutSheetKit.setConfig,
    ).toHaveBeenLastCalledWith(newConfig);
  });

  it('keeps a stable context value across re-renders', async () => {
    const values: any[] = [];
    const onHookValue = (value: any) => {
      values.push(value);
    };

    const {rerender} = render(
      <ShopifyCheckoutSheetProvider configuration={config}>
        <HookTestComponent onHookValue={onHookValue} />
      </ShopifyCheckoutSheetProvider>,
    );
    await flushEffects();

    rerender(
      <ShopifyCheckoutSheetProvider configuration={config}>
        <HookTestComponent onHookValue={onHookValue} />
      </ShopifyCheckoutSheetProvider>,
    );
    await flushEffects();

    const first = values[0];
    const last = values[values.length - 1];
    expect(values.length).toBeGreaterThan(1);
    expect(last).toBe(first);
    expect(last.present).toBe(first.present);
    expect(last.addEventListener).toBe(first.addEventListener);
  });
});

describe('ShopifyCheckoutSheetContext without provider', () => {
  it('throws error when hook is used without provider', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      render(<HookTestComponent onHookValue={() => {}} />);
    }).toThrow(
      'useShopifyCheckoutSheet must be used from within a ShopifyCheckoutSheetContext',
    );

    errorSpy.mockRestore();
  });
});
