import { BBAuthNavigator } from '../shared/navigator';

import { BBCsrfXhr } from './csrf-xhr';

import { BBAuthTokenError, BBAuthTokenErrorCode } from '../auth';

import { BBAuthDomain } from '../auth/auth-domain';

import 'jasmine-ajax';

describe('Auth token integration', () => {
  let navigateSpy: jasmine.Spy;
  let domainSpy: jasmine.Spy;

  beforeAll(() => {
    jasmine.Ajax.install();

    navigateSpy = spyOn(BBAuthNavigator, 'navigate');
    domainSpy = spyOn(BBAuthDomain, 'getSTSDomain');
  });

  beforeEach(() => {
    navigateSpy.and.stub();
    navigateSpy.calls.reset();
  });

  afterAll(() => {
    jasmine.Ajax.uninstall();
  });

  it('should redirect to the signin page if the user is not signed in', (done) => {
    navigateSpy.and.callFake((url: string) => {
      expect(url).toBe(
        'https://signin.blackbaud.com/signin/?redirectUrl=' +
          encodeURIComponent(location.href)
      );
      done();
    });

    BBCsrfXhr.request('https://example.com/token');
    const request = jasmine.Ajax.requests.mostRecent();

    request.respondWith({
      responseText: undefined,
      status: 401,
    });

    expect(domainSpy).toHaveBeenCalled();
  });

  it('should redirect to the signin page if the user is not signed in and posting with csrf', (done) => {
    navigateSpy.and.callFake((url: string) => {
      expect(url).toBe(
        'https://signin.blackbaud.com/signin/?redirectUrl=' +
          encodeURIComponent(location.href)
      );
      done();
    });

    BBCsrfXhr.postWithCSRF('https://example.com/token');
    const request = jasmine.Ajax.requests.mostRecent();

    request.respondWith({
      responseText: undefined,
      status: 401,
    });

    expect(domainSpy).toHaveBeenCalled();
  });

  it('should not redirect to the signin page when redirecting is disabled', (done) => {
    BBCsrfXhr.request('https://example.com/token', undefined, true).catch(
      (reason: BBAuthTokenError) => {
        expect(reason.code).toBe(BBAuthTokenErrorCode.NotLoggedIn);
        expect(reason.message).toBe('The user is not logged in.');
        done();
      }
    );

    const request = jasmine.Ajax.requests.mostRecent();

    request.respondWith({
      responseText: undefined,
      status: 401,
    });
  });

  it('should not redirect to the error page when the user is offline', (done) => {
    BBCsrfXhr.request('https://example.com/token').catch(
      (reason: BBAuthTokenError) => {
        expect(reason.code).toBe(BBAuthTokenErrorCode.Offline);
        expect(reason.message).toBe('The user is offline.');
        done();
      }
    );

    const request = jasmine.Ajax.requests.mostRecent();

    request.respondWith({
      responseText: undefined,
      status: 0,
    });
  });

  it('should not redirect to the error page when the user is offline while posting with csrf', (done) => {
    BBCsrfXhr.postWithCSRF('https://example.com/token').catch(
      (reason: BBAuthTokenError) => {
        expect(reason.code).toBe(BBAuthTokenErrorCode.Offline);
        expect(reason.message).toBe('The user is offline.');
        done();
      }
    );

    const request = jasmine.Ajax.requests.mostRecent();

    request.respondWith({
      responseText: undefined,
      status: 0,
    });
  });

  it('should redirect when the user is not a member of the specified environment', (done) => {
    navigateSpy.and.callFake((url: string) => {
      expect(url).toBe(
        'https://host.nxt.blackbaud.com/errors/security?source=auth-client&url=' +
          encodeURIComponent(location.href) +
          '&code=invalid_env'
      );

      done();
    });

    BBCsrfXhr.request('https://example.com/token');

    const request = jasmine.Ajax.requests.mostRecent();

    request.respondWith({
      responseText: undefined,
      status: 403,
    });
  });

  it('should redirect to error page when any other error occurrs while posting with csrf', (done) => {
    navigateSpy.and.callFake((url: string) => {
      expect(url).toBe(
        'https://host.nxt.blackbaud.com/errors/security?source=auth-client&url=' +
          encodeURIComponent(location.href) +
          '&code=invalid_env'
      );

      done();
    });

    BBCsrfXhr.postWithCSRF('https://example.com/token');

    const request = jasmine.Ajax.requests.mostRecent();

    request.respondWith({
      responseText: undefined,
      status: 403,
    });
  });

  it('should redirect when an unknown error occurs', (done) => {
    navigateSpy.and.callFake((url: string) => {
      expect(url).toBe(
        'https://host.nxt.blackbaud.com/errors/broken?source=auth-client&url=' +
          encodeURIComponent(location.href)
      );

      done();
    });

    BBCsrfXhr.request('https://example.com/token');

    const request = jasmine.Ajax.requests.mostRecent();

    request.respondWith({
      responseText: undefined,
      status: 500,
    });
  });

  it('should return a token if the user is signed in', (done) => {
    const tokenPromise = BBCsrfXhr.request('https://example.com/token');
    const csrfRequest = jasmine.Ajax.requests.mostRecent();

    csrfRequest.respondWith({
      responseText: JSON.stringify({
        csrf_token: 'abc',
      }),
      status: 200,
    });

    // Wait for the token request to kick off.
    const intervalId = setInterval(() => {
      const tokenRequest = jasmine.Ajax.requests.mostRecent();

      if (tokenRequest.url === 'https://example.com/token') {
        clearInterval(intervalId);

        tokenRequest.respondWith({
          responseText: JSON.stringify({
            access_token: 'xyz',
            expires_in: 12345,
          }),
          status: 200,
        });

        tokenPromise.then((tokenResponse) => {
          expect(tokenResponse).toEqual({
            access_token: 'xyz',
            expires_in: 12345,
          });

          done();
        });
      }
    });
  });

  it('should return session TTL if the user is signed in', (done) => {
    const requestPromise = BBCsrfXhr.postWithCSRF(
      'https://example.com/session/ttl'
    );
    const csrfRequest = jasmine.Ajax.requests.mostRecent();

    csrfRequest.respondWith({
      responseText: JSON.stringify({
        csrf_token: 'abc',
      }),
      status: 200,
    });

    // Wait for the TTL request to kick off.
    const intervalId = setInterval(() => {
      const request = jasmine.Ajax.requests.mostRecent();
      if (request.url === 'https://example.com/session/ttl') {
        clearInterval(intervalId);

        request.respondWith({
          responseText: '1234',
          status: 200,
        });

        requestPromise.then((response) => {
          expect(response).toEqual('1234');
          done();
        });
      }
    });
  });

  it('should renew the user session if the user is signed in', (done) => {
    const requestPromise = BBCsrfXhr.postWithCSRF(
      'https://example.com/session/renew'
    );
    const csrfRequest = jasmine.Ajax.requests.mostRecent();

    csrfRequest.respondWith({
      responseText: JSON.stringify({
        csrf_token: 'abc',
      }),
      status: 200,
    });

    // Wait for the TTL request to kick off.
    const intervalId = setInterval(() => {
      const request = jasmine.Ajax.requests.mostRecent();
      if (request.url === 'https://example.com/session/renew') {
        clearInterval(intervalId);

        request.respondWith({
          status: 200,
        });

        requestPromise.then((response) => {
          expect(response).toEqual('');
          done();
        });
      }
    });
  });

  it('should not call csrf endpoint if bypassCsrf is set', (done) => {
    const tokenPromise = BBCsrfXhr.request(
      'https://example.com/token',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true
    );

    const intervalId = setInterval(() => {
      const tokenRequest = jasmine.Ajax.requests.mostRecent();

      if (tokenRequest.url === 'https://example.com/token') {
        clearInterval(intervalId);

        tokenRequest.respondWith({
          responseText: JSON.stringify({
            access_token: 'xyz',
            expires_in: 12345,
          }),
          status: 200,
        });

        tokenPromise.then((tokenResponse) => {
          expect(tokenResponse).toEqual({
            access_token: 'xyz',
            expires_in: 12345,
          });

          done();
        });
      }
    });
  });

  it('should not try to parse an empty response', () => {
    BBCsrfXhr.request('https://example.com/token');
    const request = jasmine.Ajax.requests.mostRecent();

    const parseSpy = spyOn(JSON, 'parse').and.callThrough();

    request.respondWith({
      responseText: undefined,
      status: 200,
    });

    expect(parseSpy).not.toHaveBeenCalled();
  });

  it('should append the specified signin URL params when redirected to signin', (done) => {
    navigateSpy.and.callFake((url: string) => {
      expect(url).toBe(
        'https://signin.blackbaud.com/signin/?redirectUrl=' +
          encodeURIComponent(location.href) +
          '&%3Dfoo%3D=b%26r'
      );
      done();
    });

    BBCsrfXhr.request('https://example.com/token', {
      '=foo=': 'b&r',
    });

    const request = jasmine.Ajax.requests.mostRecent();

    request.respondWith({
      responseText: undefined,
      status: 401,
    });
  });

  it('should add the environment ID to the request body', (done) => {
    BBCsrfXhr.request('https://example.com/token', undefined, undefined, 'abc');

    const csrfRequest = jasmine.Ajax.requests.mostRecent();

    csrfRequest.respondWith({
      responseText: JSON.stringify({
        csrf_token: 'abc',
      }),
      status: 200,
    });

    // Wait for the token request to kick off.
    const intervalId = setInterval(() => {
      const tokenRequest = jasmine.Ajax.requests.mostRecent();

      if (tokenRequest.url === 'https://example.com/token') {
        clearInterval(intervalId);

        const requestData = tokenRequest.data();

        expect(requestData).toEqual({
          environment_id: 'abc',
        });

        done();
      }
    });
  });

  it('should add the legal entity ID to the request body', (done) => {
    BBCsrfXhr.request(
      'https://example.com/token',
      undefined,
      undefined,
      'abc',
      undefined,
      'def'
    );

    const csrfRequest = jasmine.Ajax.requests.mostRecent();

    csrfRequest.respondWith({
      responseText: JSON.stringify({
        csrf_token: 'abc',
      }),
      status: 200,
    });

    // Wait for the token request to kick off.
    const intervalId = setInterval(() => {
      const tokenRequest = jasmine.Ajax.requests.mostRecent();
      if (tokenRequest.url === 'https://example.com/token') {
        clearInterval(intervalId);

        const requestData = tokenRequest.data();

        expect(requestData).toEqual({
          environment_id: 'abc',
          legal_entity_id: 'def',
        });

        done();
      }
    });
  });

  it('should add the environment ID and permission scope to the request body', (done) => {
    BBCsrfXhr.request(
      'https://example.com/token',
      undefined,
      undefined,
      'abc',
      '123'
    );

    const csrfRequest = jasmine.Ajax.requests.mostRecent();

    csrfRequest.respondWith({
      responseText: JSON.stringify({
        csrf_token: 'abc',
      }),
      status: 200,
    });

    // Wait for the token request to kick off.
    const intervalId = setInterval(() => {
      const tokenRequest = jasmine.Ajax.requests.mostRecent();

      if (tokenRequest.url === 'https://example.com/token') {
        clearInterval(intervalId);

        const requestData = tokenRequest.data();

        expect(requestData).toEqual({
          environment_id: 'abc',
          permission_scope: '123',
        });

        done();
      }
    });
  });

  it('should require environment ID or legal entity ID when permission scope is specified', (done) => {
    BBCsrfXhr.request(
      'https://example.com/token',
      undefined,
      undefined,
      undefined,
      '123'
    ).catch((reason: BBAuthTokenError) => {
      expect(reason.code).toBe(
        BBAuthTokenErrorCode.PermissionScopeNoEnvironment
      );
      expect(reason.message).toBe(
        'You must also specify an environment or legal entity when specifying a permission scope.'
      );
      done();
    });
  });

  describe('requestWithToken()', () => {
    function validateRequestWithToken(
      done: DoneFn,
      verb = 'GET',
      data?: Record<string, string>
    ): void {
      BBCsrfXhr.requestWithToken(
        'https://example.com/token',
        'abc',
        verb,
        data
      ).then((response) => {
        expect(response).toEqual({
          success: true,
        });

        done();
      });

      const request = jasmine.Ajax.requests.mostRecent();

      expect(request.url).toBe('https://example.com/token');
      expect(request.method).toBe(verb);

      if (data) {
        expect(request.data()).toEqual(data);
      }

      const expectedHeaders: Record<string, string> = {
        Accept: 'application/json',
        Authorization: 'Bearer abc',
      };

      if (data) {
        expectedHeaders['Content-Type'] = 'application/json';
      }

      expect(request.requestHeaders).toEqual(expectedHeaders);

      request.respondWith({
        responseText: JSON.stringify({
          success: true,
        }),
        status: 200,
      });
    }

    it('should support GET', (done) => {
      validateRequestWithToken(done, 'GET');
    });

    it('should support PATCH', (done) => {
      validateRequestWithToken(done, 'PATCH', {
        foo: 'test',
      });
    });

    it('should support POST', (done) => {
      validateRequestWithToken(done, 'POST', {
        foo: 'test',
      });
    });

    it('should handle errors', (done) => {
      BBCsrfXhr.requestWithToken('https://example.com/token', 'abc').then(
        () => {
          /* do nothing */
        },
        () => {
          done();
        }
      );

      const request = jasmine.Ajax.requests.mostRecent();

      request.respondWith({
        status: 401,
      });
    });

    it('should handle empty response text', (done) => {
      BBCsrfXhr.requestWithToken('https://example.com/token', 'abc').then(
        () => {
          done();
        }
      );

      const request = jasmine.Ajax.requests.mostRecent();

      expect(request.url).toBe('https://example.com/token');

      request.respondWith({
        responseText: undefined,
        status: 200,
      });
    });
  });
});
