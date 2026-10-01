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

// @ts-expect-error "eventEmitter is private"
const eventEmitter = ShopifyCheckoutSheet.eventEmitter;

const flushConfiguration = () =>
  act(async () => {
    await new Promise(resolve => setImmediate(resolve));
  });

const acceleratedCheckouts: NonNullable<Configuration['acceleratedCheckouts']> =
  {
    storefrontDomain: 'test-shop.myshopify.com',
    storefrontAccessToken: 'shpat_test_token',
  };

describe('ShopifyCheckoutSheetProvider', () => {
  const TestComponent = ({children}: {children: React.ReactNode}) => (
    <ShopifyCheckoutSheetProvider configuration={config}>
      {children}
    </ShopifyCheckoutSheetProvider>
  );

  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
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

  it('re-applies a changed configuration on the same instance', () => {
    const newConfig: Configuration = {colorScheme: ColorScheme.light};
    const {rerender} = render(
      <ShopifyCheckoutSheetProvider configuration={config}>
        <MockChild />
      </ShopifyCheckoutSheetProvider>,
    );

    rerender(
      <ShopifyCheckoutSheetProvider configuration={newConfig}>
        <MockChild />
      </ShopifyCheckoutSheetProvider>,
    );

    const {setConfig} = NativeModules.ShopifyCheckoutSheetKit;
    expect(setConfig).toHaveBeenCalledTimes(3);
    expect(setConfig).toHaveBeenLastCalledWith(newConfig);
  });

  describe('acceleratedCheckoutsAvailable', () => {
    const {configureAcceleratedCheckouts} =
      NativeModules.ShopifyCheckoutSheetKit;

    beforeEach(() => {
      (Platform as any).Version = '17.0';
    });

    afterEach(() => {
      delete (Platform as any).Version;
      configureAcceleratedCheckouts.mockReturnValue(true);
    });

    const renderAvailability = (configuration: Configuration) => {
      let hookValue: any;
      render(
        <ShopifyCheckoutSheetProvider configuration={configuration}>
          <HookTestComponent onHookValue={value => (hookValue = value)} />
        </ShopifyCheckoutSheetProvider>,
      );
      return () => hookValue.acceleratedCheckoutsAvailable;
    };

    it('becomes true once accelerated checkouts are configured', async () => {
      const isAvailable = renderAvailability({...config, acceleratedCheckouts});
      expect(isAvailable()).toBe(false);

      await flushConfiguration();

      expect(isAvailable()).toBe(true);
    });

    it('stays false when native configuration fails', async () => {
      configureAcceleratedCheckouts.mockReturnValue(false);
      const isAvailable = renderAvailability({...config, acceleratedCheckouts});

      await flushConfiguration();

      expect(configureAcceleratedCheckouts).toHaveBeenCalled();
      expect(isAvailable()).toBe(false);
    });

    it('stays false when accelerated checkouts are not configured', async () => {
      const isAvailable = renderAvailability(config);

      await flushConfiguration();

      expect(
        NativeModules.ShopifyCheckoutSheetKit.setConfig,
      ).toHaveBeenCalledWith(config);
      expect(configureAcceleratedCheckouts).not.toHaveBeenCalled();
      expect(isAvailable()).toBe(false);
    });
  });

  describe('customer accessToken deprecation warning', () => {
    it.each([
      [
        'warns for accessToken with email',
        {accessToken: 'token', email: 'a@b.com'},
        1,
      ],
      [
        'warns for accessToken with phoneNumber',
        {accessToken: 'token', phoneNumber: '+1'},
        1,
      ],
      ['does not warn for accessToken only', {accessToken: 'token'}, 0],
      [
        'does not warn for email and phoneNumber only',
        {email: 'a@b.com', phoneNumber: '+1'},
        0,
      ],
    ])('%s', async (_label, customer, expectedWarnings) => {
      render(
        <ShopifyCheckoutSheetProvider
          configuration={{
            ...config,
            acceleratedCheckouts: {...acceleratedCheckouts, customer},
          }}>
          <MockChild />
        </ShopifyCheckoutSheetProvider>,
      );

      await flushConfiguration();

      expect(warnSpy).toHaveBeenCalledTimes(expectedWarnings);
      if (expectedWarnings) {
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Providing accessToken with contactFields'),
        );
      }
    });
  });

  describe('features', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    afterEach(() => {
      Platform.OS = 'ios';
    });

    it('subscribes to geolocation requests on Android by default', () => {
      render(
        <TestComponent>
          <MockChild />
        </TestComponent>,
      );

      expect(eventEmitter.addListener).toHaveBeenCalledWith(
        'geolocationRequest',
        expect.any(Function),
      );
    });

    it('does not subscribe when handleGeolocationRequests is disabled', () => {
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

  it('stops delivering events after removeEventListeners', () => {
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

  it('keeps context callbacks stable across re-renders', () => {
    const hookValues: any[] = [];
    const renderTree = () => (
      <Wrapper>
        <HookTestComponent onHookValue={value => hookValues.push(value)} />
      </Wrapper>
    );

    const {rerender} = render(renderTree());
    rerender(renderTree());

    const [first, last] = [hookValues[0], hookValues[hookValues.length - 1]];
    expect(hookValues.length).toBeGreaterThan(1);
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
