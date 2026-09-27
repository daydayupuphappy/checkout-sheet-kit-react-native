import React from 'react';
import {render, act, waitFor} from '@testing-library/react-native';
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

jest.mock('react-native');

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

const acceleratedConfig: Configuration = {
  ...config,
  acceleratedCheckouts: {
    storefrontDomain: 'test-shop.myshopify.com',
    storefrontAccessToken: 'shpat_test_token',
  },
};

function withCustomer(
  customer: NonNullable<Configuration['acceleratedCheckouts']>['customer'],
): Configuration {
  return {
    ...acceleratedConfig,
    acceleratedCheckouts: {
      ...acceleratedConfig.acceleratedCheckouts!,
      customer,
    },
  };
}

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
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
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

    warnSpy.mockRestore();
  });

  describe('acceleratedCheckoutsAvailable', () => {
    function renderAndGetHookValue(configuration?: Configuration) {
      let hookValue: any;
      render(
        <ShopifyCheckoutSheetProvider configuration={configuration}>
          <HookTestComponent onHookValue={value => (hookValue = value)} />
        </ShopifyCheckoutSheetProvider>,
      );
      return () => hookValue;
    }

    it('becomes true once accelerated checkouts are configured', async () => {
      const getHookValue = renderAndGetHookValue(acceleratedConfig);

      expect(getHookValue().acceleratedCheckoutsAvailable).toBe(false);

      await waitFor(() => {
        expect(getHookValue().acceleratedCheckoutsAvailable).toBe(true);
      });
    });

    it('stays false when native configuration fails', async () => {
      const configureMock =
        NativeModules.ShopifyCheckoutSheetKit.configureAcceleratedCheckouts;
      configureMock.mockReturnValue(false);

      const getHookValue = renderAndGetHookValue(acceleratedConfig);

      await act(async () => {
        await Promise.resolve();
      });

      expect(configureMock).toHaveBeenCalled();
      expect(getHookValue().acceleratedCheckoutsAvailable).toBe(false);

      configureMock.mockReturnValue(true);
    });

    it('stays false when no accelerated checkouts are configured', async () => {
      const getHookValue = renderAndGetHookValue(config);

      await act(async () => {
        await Promise.resolve();
      });

      expect(
        NativeModules.ShopifyCheckoutSheetKit.configureAcceleratedCheckouts,
      ).not.toHaveBeenCalled();
      expect(getHookValue().acceleratedCheckoutsAvailable).toBe(false);
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

    async function renderWithCustomer(
      customer: Parameters<typeof withCustomer>[0],
    ) {
      render(
        <ShopifyCheckoutSheetProvider configuration={withCustomer(customer)}>
          <MockChild />
        </ShopifyCheckoutSheetProvider>,
      );

      await act(async () => {
        await Promise.resolve();
      });
    }

    it.each([
      ['email', {accessToken: 'token', email: 'test@example.com'}],
      ['phoneNumber', {accessToken: 'token', phoneNumber: '+123'}],
    ])('warns when accessToken is combined with %s', async (_, customer) => {
      await renderWithCustomer(customer);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('accessToken');
    });

    it.each([
      ['accessToken only', {accessToken: 'token'}],
      ['contact fields only', {email: 'test@example.com', phoneNumber: '+123'}],
      ['no customer', undefined],
    ])('does not warn with %s', async (_, customer) => {
      await renderWithCustomer(customer);

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  it('applies a new configuration when the prop changes', () => {
    const {rerender} = render(
      <ShopifyCheckoutSheetProvider configuration={config}>
        <MockChild />
      </ShopifyCheckoutSheetProvider>,
    );
    NativeModules.ShopifyCheckoutSheetKit.setConfig.mockClear();

    const newConfig: Configuration = {colorScheme: ColorScheme.dark};
    rerender(
      <ShopifyCheckoutSheetProvider configuration={newConfig}>
        <MockChild />
      </ShopifyCheckoutSheetProvider>,
    );

    expect(
      NativeModules.ShopifyCheckoutSheetKit.setConfig,
    ).toHaveBeenCalledTimes(1);
    expect(
      NativeModules.ShopifyCheckoutSheetKit.setConfig,
    ).toHaveBeenCalledWith(newConfig);
  });

  describe('features', () => {
    // @ts-expect-error "eventEmitter is private"
    const eventEmitter = ShopifyCheckoutSheet.eventEmitter;
    const originalOS = Platform.OS;

    beforeEach(() => {
      (Platform as any).OS = 'android';
    });

    afterEach(() => {
      (Platform as any).OS = originalOS;
    });

    it('subscribes to geolocation requests by default on Android', () => {
      render(
        <ShopifyCheckoutSheetProvider configuration={config}>
          <MockChild />
        </ShopifyCheckoutSheetProvider>,
      );

      expect(eventEmitter.addListener).toHaveBeenCalledWith(
        'geolocationRequest',
        expect.any(Function),
      );
    });

    it('forwards features to disable geolocation handling', () => {
      render(
        <ShopifyCheckoutSheetProvider
          configuration={config}
          features={{handleGeolocationRequests: false}}>
          <MockChild />
        </ShopifyCheckoutSheetProvider>,
      );

      expect(eventEmitter.addListener).not.toHaveBeenCalledWith(
        'geolocationRequest',
        expect.any(Function),
      );
    });
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

  describe('event listeners', () => {
    // @ts-expect-error "eventEmitter is private"
    const eventEmitter = ShopifyCheckoutSheet.eventEmitter;

    it('invokes the callback when the event is emitted', () => {
      let hookValue: any;
      const callback = jest.fn();

      render(
        <Wrapper>
          <HookTestComponent onHookValue={value => (hookValue = value)} />
        </Wrapper>,
      );

      hookValue.addEventListener('completed', callback);
      eventEmitter.emit('completed', {orderDetails: {id: 'test-id'}});

      expect(callback).toHaveBeenCalledWith({orderDetails: {id: 'test-id'}});
    });

    it('removes all native listeners for the event', () => {
      let hookValue: any;

      render(
        <Wrapper>
          <HookTestComponent onHookValue={value => (hookValue = value)} />
        </Wrapper>,
      );

      hookValue.removeEventListeners('close');

      expect(eventEmitter.removeAllListeners).toHaveBeenCalledWith('close');
    });
  });

  it('keeps context functions referentially stable across re-renders', () => {
    const values: any[] = [];

    const {rerender} = render(
      <Wrapper>
        <HookTestComponent onHookValue={value => values.push(value)} />
      </Wrapper>,
    );
    rerender(
      <Wrapper>
        <HookTestComponent onHookValue={value => values.push(value)} />
      </Wrapper>,
    );

    const [first, last] = [values[0], values[values.length - 1]];
    expect(values.length).toBeGreaterThan(1);
    for (const key of [
      'addEventListener',
      'removeEventListeners',
      'present',
      'preload',
      'dismiss',
      'invalidate',
      'setConfig',
      'getConfig',
    ]) {
      expect(last[key]).toBe(first[key]);
    }
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
