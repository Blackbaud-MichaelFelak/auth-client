//#region imports

import {
  BBAuthDomUtility
} from '../shared/dom-utility';

import {
  BBAuthNavigator
} from '../shared/navigator';

import {
  BBAuthGetTokenArgs
} from './auth-get-token-args';

import {
  BBAuthTokenError
} from './auth-token-error';

import {
  BBAuthTokenErrorCode
} from './auth-token-error-code';

import {
  BBAuthTokenResponse
} from './auth-token-response';

//#endregion

const URL = 'https://s21aidntoken00blkbapp01.nxt.blackbaud.com/Iframes/CrossDomainAuthFrame.html'; // URL to get IFrame
const HOST = 'security-token-svc';
const SOURCE = 'auth-client';

export class BBAuthCrossDomainIframe {

//#region static features

  public static iframeEl: HTMLIFrameElement;
  public static listenerSetup = false;
  public static iframeReadyResolve: any;
  public static iframeReadyPromise = new Promise<boolean>((resolve) =>
    BBAuthCrossDomainIframe.iframeReadyResolve = resolve
  );
  public static tokenRequests: any = {};

  private static TARGETORIGIN = 'https://s21aidntoken00blkbapp01.nxt.blackbaud.com';

  public static TARGET_ORIGIN() {
    return this.TARGETORIGIN;
  }

  public static getOrMakeIframe(): HTMLIFrameElement {
    BBAuthCrossDomainIframe.iframeEl = document.getElementById('auth-cross-domain-iframe') as HTMLIFrameElement;

    // if iframe doesn't exist, make it
    if (!BBAuthCrossDomainIframe.iframeEl) {
      BBAuthCrossDomainIframe.iframeEl = BBAuthDomUtility.addIframe(
        URL,
        'auth-cross-domain-iframe',
        ''
      );

      BBAuthCrossDomainIframe.iframeEl.id = 'auth-cross-domain-iframe';
      BBAuthCrossDomainIframe.iframeEl.hidden = true;
    }

    return BBAuthCrossDomainIframe.iframeEl;
  }

//#endregion static features

//#region instance features

  public static getToken(args: BBAuthGetTokenArgs): Promise<BBAuthTokenResponse> {
    this.setupListenersForIframe();

    return this.getTokenFromIframe(
      BBAuthCrossDomainIframe.getOrMakeIframe(),
      args
    );
  }

  public static setupListenersForIframe() {
    if (BBAuthCrossDomainIframe.listenerSetup) {
      return;
    }

    window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data;
      const tokenRequestId = message.requestId;
      const tokenRequest = BBAuthCrossDomainIframe.tokenRequests[tokenRequestId];

      if (message.source !== HOST && message.origin !== BBAuthCrossDomainIframe.TARGET_ORIGIN) {
        return;
      }

      switch (message.messageType) {
        case 'ready':
          BBAuthCrossDomainIframe.iframeReadyResolve(true);

          break;
        case 'error':
          this.handleErrorMessage(message.value, tokenRequest.reject);

          break;
        case 'getToken':
          const tokenResponse: BBAuthTokenResponse = {
            access_token: message.value,
            expires_in: 0
          };

          tokenRequest.resolve(tokenResponse);

          break;
        }
    });
  }

  public static getTokenFromIframe(
    iframeEl: HTMLIFrameElement,
    args: BBAuthGetTokenArgs
  ): Promise<BBAuthTokenResponse> {
    return new Promise<BBAuthTokenResponse>((resolve, reject) => {
      const tokenRequestId = Date.now();
      BBAuthCrossDomainIframe.tokenRequests[tokenRequestId] = {
        resolve,
        reject
      };

      BBAuthCrossDomainIframe.iframeReadyPromise.then(() => {
        iframeEl.contentWindow.postMessage({
          messageType: 'getToken',
          requestId: tokenRequestId,
          source: SOURCE,
          value: args
        },
        BBAuthCrossDomainIframe.TARGET_ORIGIN());
      });
    });
  }

  public static handleErrorMessage(reason: BBAuthTokenError, reject: any) {
    switch (reason.code) {
      case BBAuthTokenErrorCode.Offline:
        reject(reason);

        break;
      case BBAuthTokenErrorCode.NotLoggedIn:
        BBAuthNavigator.redirectToSignin(undefined);

        break;
      default:
        BBAuthNavigator.redirectToError(reason.code);
    }
  }

//#endregion instance features

}
