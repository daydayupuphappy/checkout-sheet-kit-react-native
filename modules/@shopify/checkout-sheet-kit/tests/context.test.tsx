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
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Providing accessToken with contactFields'),
    );

    warnSpy.mockRestore();
  });

  it('reuses the same instance across re-renders', () => {
    const hookValues: any[] = [];
    const onHookValue = (value: any) => {
      hookValues.push(value);
    };

    const {rerender} = render(
      <TestComponent>
        <HookTestComponent onHookValue={onHookValue} />
      </TestComponent>,
    );

    rerender(
      <TestComponent>
        <HookTestComponent onHookValue={onHookValue} />
      </TestComponent>,
    );

    expect(
      NativeModules.ShopifyCheckoutSheetKit.setConfig.mock.calls,
    ).toHaveLength(2);
    expect(hookValues).toHaveLength(2);
    expect(hookValues[1]).toBe(hookValues[0]);
  });

  it('re-applies configuration when the configuration prop changes', () => {
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

    expect(
      NativeModules.ShopifyCheckoutSheetKit.setConfig,
    ).toHaveBeenLastCalledWith(updatedConfig);
  });

  describe('acceleratedCheckoutsAvailable', () => {
    const configureAcceleratedCheckouts = NativeModules.ShopifyCheckoutSheetKit
      .configureAcceleratedCheckouts as unknown as {mockReturnValue: any};

    const acceleratedConfig: Configuration = {
      ...config,
      acceleratedCheckouts: {
        storefrontDomain: 'test-shop.myshopify.com',
        storefrontAccessToken: 'shpat_test_token',
      },
    };

    const renderAndSettle = async (configuration: Configuration) => {
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

      await act(async () => {
        await Promise.resolve();
      });

      return hookValue;
    };

    beforeEach(() => {
      (Platform as any).Version = '17.0';
    });

    afterEach(() => {
      configureAcceleratedCheckouts.mockReturnValue(true);
    });

    it('is false when accelerated checkouts are not configured', async () => {
      const hookValue = await renderAndSettle(config);

      expect(hookValue.acceleratedCheckoutsAvailable).toBe(false);
    });

    it('is true once accelerated checkouts are configured', async () => {
      configureAcceleratedCheckouts.mockReturnValue(true);

      const hookValue = await renderAndSettle(acceleratedConfig);

      expect(hookValue.acceleratedCheckoutsAvailable).toBe(true);
    });

    it('is false when native configuration fails', async () => {
      configureAcceleratedCheckouts.mockReturnValue(false);

      const hookValue = await renderAndSettle(acceleratedConfig);

      expect(hookValue.acceleratedCheckoutsAvailable).toBe(false);
    });
  });

  describe('accessToken deprecation warning', () => {
    const renderWithCustomer = async (
      customer: NonNullable<Configuration['acceleratedCheckouts']>['customer'],
    ) => {
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

      await act(async () => {
        await Promise.resolve();
      });
    };

    it('warns when accessToken is provided with phoneNumber', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await renderWithCustomer({accessToken: 'token', phoneNumber: '+123'});

      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it.each([
      ['accessToken only', {accessToken: 'token'}],
      ['email only', {email: 'test@example.com'}],
      ['phoneNumber only', {phoneNumber: '+123'}],
    ])('does not warn for %s', async (_, customer) => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await renderWithCustomer(customer);

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('features', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('subscribes to geolocation requests on Android by default', () => {
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

    it('passes features to the checkout instance', () => {
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

    const callback = jest.fn();
    const subscription = hookValue.addEventListener('close', callback);
    expect(eventEmitter.addListener).toHaveBeenCalledWith('close', callback);
    expect(subscription).toBeDefined();
    expect(subscription.remove).toBeDefined();
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
