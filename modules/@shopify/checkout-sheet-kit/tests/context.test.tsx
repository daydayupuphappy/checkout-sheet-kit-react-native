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

const flushEffects = () =>
  act(async () => {
    await Promise.resolve();
  });

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

  const originalPlatform = {OS: Platform.OS, Version: Platform.Version};

  afterEach(() => {
    Platform.OS = originalPlatform.OS;
    (Platform as any).Version = originalPlatform.Version;
    (
      NativeModules.ShopifyCheckoutSheetKit
        .configureAcceleratedCheckouts as unknown as {mockReturnValue: any}
    ).mockReturnValue(true);
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

  it('re-applies configuration on the same instance when the configuration prop changes', () => {
    const updatedConfig: Configuration = {colorScheme: ColorScheme.dark};

    const {rerender} = render(
      <ShopifyCheckoutSheetProvider configuration={config}>
        <MockChild />
      </ShopifyCheckoutSheetProvider>,
    );

    rerender(
      <ShopifyCheckoutSheetProvider configuration={updatedConfig}>
        <MockChild />
      </ShopifyCheckoutSheetProvider>,
    );

    const {setConfig} = NativeModules.ShopifyCheckoutSheetKit;
    // constructor + initial effect + effect for the updated prop
    expect(setConfig.mock.calls).toEqual([[config], [config], [updatedConfig]]);
  });

  describe('acceleratedCheckoutsAvailable', () => {
    const acceleratedConfig: Configuration = {
      ...config,
      acceleratedCheckouts: {
        storefrontDomain: 'test-shop.myshopify.com',
        storefrontAccessToken: 'shpat_test_token',
      },
    };

    const renderAndCollect = async (configuration: Configuration) => {
      const values: boolean[] = [];
      render(
        <ShopifyCheckoutSheetProvider configuration={configuration}>
          <HookTestComponent
            onHookValue={value =>
              values.push(value.acceleratedCheckoutsAvailable)
            }
          />
        </ShopifyCheckoutSheetProvider>,
      );
      await flushEffects();
      return values;
    };

    beforeEach(() => {
      (Platform as any).Version = '17.0';
    });

    it('starts false and becomes true once accelerated checkouts are configured', async () => {
      const values = await renderAndCollect(acceleratedConfig);

      expect(values[0]).toBe(false);
      expect(values[values.length - 1]).toBe(true);
    });

    it('stays false when accelerated checkouts are not configured', async () => {
      const values = await renderAndCollect(config);

      expect(values).not.toContain(true);
    });

    it('stays false when native configuration fails', async () => {
      (
        NativeModules.ShopifyCheckoutSheetKit
          .configureAcceleratedCheckouts as unknown as {mockReturnValue: any}
      ).mockReturnValue(false);

      const values = await renderAndCollect(acceleratedConfig);

      expect(values).not.toContain(true);
    });

    it('stays false on iOS versions below 16', async () => {
      (Platform as any).Version = '15.0';

      const values = await renderAndCollect(acceleratedConfig);

      expect(values).not.toContain(true);
      expect(
        NativeModules.ShopifyCheckoutSheetKit.configureAcceleratedCheckouts,
      ).not.toHaveBeenCalled();
    });
  });

  describe('accessToken deprecation warning', () => {
    type Customer = NonNullable<
      Configuration['acceleratedCheckouts']
    >['customer'];

    const renderWithCustomer = async (customer: Customer) => {
      render(
        <ShopifyCheckoutSheetProvider
          configuration={{
            ...config,
            acceleratedCheckouts: {
              storefrontDomain: 'test-shop.myshopify.com',
              storefrontAccessToken: 'shpat_test_token',
              customer,
            },
          }}>
          <MockChild />
        </ShopifyCheckoutSheetProvider>,
      );
      await flushEffects();
    };

    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it.each<[string, Customer]>([
      ['email', {accessToken: 'token', email: 'test@example.com'}],
      ['phoneNumber', {accessToken: 'token', phoneNumber: '+123'}],
    ])('warns when accessToken is combined with %s', async (_, customer) => {
      await renderWithCustomer(customer);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Providing accessToken with contactFields'),
      );
    });

    it.each<[string, Customer]>([
      ['accessToken only', {accessToken: 'token'}],
      ['contact fields only', {email: 'test@example.com', phoneNumber: '+123'}],
    ])('does not warn for %s', async (_, customer) => {
      await renderWithCustomer(customer);

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('features', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('handles geolocation requests on Android by default', () => {
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

    it('does not handle geolocation requests when the feature is disabled', () => {
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

  it('delivers emitted events to listeners added via addEventListener', () => {
    let hookValue: any;
    const callback = jest.fn();

    render(
      <Wrapper>
        <HookTestComponent onHookValue={value => (hookValue = value)} />
      </Wrapper>,
    );

    hookValue.addEventListener('close', callback);
    eventEmitter.emit('close');

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('removeEventListeners stops delivery for that event', () => {
    let hookValue: any;
    const callback = jest.fn();

    render(
      <Wrapper>
        <HookTestComponent onHookValue={value => (hookValue = value)} />
      </Wrapper>,
    );

    hookValue.addEventListener('close', callback);
    hookValue.removeEventListeners('close');
    eventEmitter.emit('close');

    expect(eventEmitter.removeAllListeners).toHaveBeenCalledWith('close');
    expect(callback).not.toHaveBeenCalled();
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
