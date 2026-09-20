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

jest.mock('react-native');

// @ts-expect-error "eventEmitter is private"
const eventEmitter = ShopifyCheckoutSheet.eventEmitter;

const acceleratedCheckouts = {
  storefrontDomain: 'test-shop.myshopify.com',
  storefrontAccessToken: 'shpat_test_token',
};

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

  it('renders children', () => {
    const {getByTestId} = render(
      <TestComponent>
        {React.createElement('View', {testID: 'child'})}
      </TestComponent>,
    );

    expect(getByTestId('child')).toBeTruthy();
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

  describe('deprecation warning', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    async function renderWithCustomer(
      customer: NonNullable<Configuration['acceleratedCheckouts']>['customer'],
    ) {
      render(
        <ShopifyCheckoutSheetProvider
          configuration={{
            ...config,
            acceleratedCheckouts: {...acceleratedCheckouts, customer},
          }}>
          <MockChild />
        </ShopifyCheckoutSheetProvider>,
      );
      await flushEffects();
    }

    it('warns when accessToken is combined with email', async () => {
      await renderWithCustomer({
        accessToken: 'customer-access-token',
        email: 'test@example.com',
      });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[ShopifyCheckoutSheetKit] Providing accessToken with contactFields',
        ),
      );
    });

    it('warns when accessToken is combined with phoneNumber', async () => {
      await renderWithCustomer({
        accessToken: 'customer-access-token',
        phoneNumber: '+123',
      });

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('does not warn when only accessToken is provided', async () => {
      await renderWithCustomer({accessToken: 'customer-access-token'});

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn when only contact fields are provided', async () => {
      await renderWithCustomer({
        email: 'test@example.com',
        phoneNumber: '+123',
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn when no customer is provided', async () => {
      await renderWithCustomer(undefined);

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('acceleratedCheckoutsAvailable', () => {
    const configureAcceleratedCheckouts = NativeModules.ShopifyCheckoutSheetKit
      .configureAcceleratedCheckouts as jest.Mock;

    afterEach(() => {
      configureAcceleratedCheckouts.mockReturnValue(true);
    });

    async function renderAndGetHookValue(configuration?: Configuration) {
      let hookValue: any;
      render(
        <ShopifyCheckoutSheetProvider configuration={configuration}>
          <HookTestComponent
            onHookValue={value => {
              hookValue = value;
            }}
          />
        </ShopifyCheckoutSheetProvider>,
      );
      await flushEffects();
      return hookValue;
    }

    it('is false when accelerated checkouts are not configured', async () => {
      const hookValue = await renderAndGetHookValue(config);

      expect(hookValue.acceleratedCheckoutsAvailable).toBe(false);
      expect(configureAcceleratedCheckouts).not.toHaveBeenCalled();
    });

    it('is true when native configuration succeeds', async () => {
      configureAcceleratedCheckouts.mockReturnValue(true);

      const hookValue = await renderAndGetHookValue({
        ...config,
        acceleratedCheckouts,
      });

      expect(hookValue.acceleratedCheckoutsAvailable).toBe(true);
    });

    it('is false when native configuration fails', async () => {
      configureAcceleratedCheckouts.mockReturnValue(false);

      const hookValue = await renderAndGetHookValue({
        ...config,
        acceleratedCheckouts,
      });

      expect(hookValue.acceleratedCheckoutsAvailable).toBe(false);
    });
  });

  it('applies a new configuration when the prop changes', async () => {
    const newConfig: Configuration = {colorScheme: ColorScheme.dark};
    const {rerender} = render(
      <ShopifyCheckoutSheetProvider configuration={config}>
        <MockChild />
      </ShopifyCheckoutSheetProvider>,
    );
    await flushEffects();

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

  describe('features', () => {
    const originalPlatform = Platform.OS;

    beforeEach(() => {
      Platform.OS = 'android';
    });

    afterAll(() => {
      Platform.OS = originalPlatform;
    });

    it('forwards features to the ShopifyCheckoutSheet instance', () => {
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

    it('uses default features when none are provided', () => {
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

    expect(eventEmitter.removeAllListeners).toHaveBeenCalledWith('close');
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

  it('addEventListener forwards the event to the emitter', () => {
    let hookValue: any;
    const onHookValue = (value: any) => {
      hookValue = value;
    };
    const callback = jest.fn();

    render(
      <Wrapper>
        <HookTestComponent onHookValue={onHookValue} />
      </Wrapper>,
    );

    hookValue.addEventListener('close', callback);
    expect(eventEmitter.addListener).toHaveBeenCalledWith(
      'close',
      expect.any(Function),
    );

    eventEmitter.emit('close');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('keeps the context value stable across re-renders', () => {
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

    expect(values.length).toBeGreaterThanOrEqual(2);
    expect(values[values.length - 1]).toBe(values[0]);
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
