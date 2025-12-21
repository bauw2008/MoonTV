function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function getMimeType(url) {
  const extension = url
    .split('?')[0]
    .split('#')[0]
    .split('.')
    .pop()
    .toLowerCase();
  const mimeTypes = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    ogv: 'video/ogg',
    mp3: 'audio/mp3',
    wav: 'audio/wav',
    flv: 'video/x-flv',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    wmv: 'video/x-ms-wmv',
    mpd: 'application/dash+xml',
    m3u8: 'application/x-mpegURL',
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

export default function artplayerPluginChromecast(option) {
  const DEFAULT_ICON = `<svg height="20" width="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M512 96H64v99c-13-2-26.4-3-40-3H0V96C0 60.7 28.7 32 64 32H512c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H288V456c0-13.6-1-27-3-40H512V96zM24 224c128.1 0 232 103.9 232 232c0 13.3-10.7 24-24 24s-24-10.7-24-24c0-101.6-82.4-184-184-184c-13.3 0-24-10.7-24-24s10.7-24 24-24zm8 192a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM0 344c0-13.3 10.7-24 24-24c75.1 0 136 60.9 136 136c0 13.3-10.7 24-24 24s-24-10.7-24-24c0-48.6-39.4-88-88-88c-13.3 0-24-10.7-24-24z"/></svg>`;
  const DEFAULT_SDK =
    'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

  let isCastInitialized = false;
  let castSession = null;
  let castState = null;

  const updateCastButton = (state) => {
    const button = document.querySelector('.art-icon-cast');
    if (button) {
      switch (state) {
        case 'connected':
          button.style.color = 'red';
          break;
        case 'connecting':
        case 'disconnecting':
          button.style.color = 'orange';
          break;
        case 'disconnected':
        default:
          button.style.color = 'white';
          break;
      }
    }
  };

  const initializeCastApi = () => {
    return new Promise((resolve, reject) => {
      // 检查是否为 HTTPS 或 localhost
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        reject(new Error('Cast API requires HTTPS or localhost'));
        return;
      }

      window.__onGCastApiAvailable = (isAvailable) => {
        if (isAvailable) {
          try {
            const context = window.cast.framework.CastContext.getInstance();
            context.setOptions({
              receiverApplicationId:
                window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
              autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
            });

            // Listen for session state changes
            context.addEventListener(
              window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
              (event) => {
                const SessionState = window.cast.framework.SessionState;
                castState = event.sessionState;
                castSession = event.session;

                switch (event.sessionState) {
                  case SessionState.NO_SESSION:
                    option.onStateChange?.('disconnected');
                    updateCastButton('disconnected');
                    break;
                  case SessionState.SESSION_STARTING:
                    option.onStateChange?.('connecting');
                    updateCastButton('connecting');
                    break;
                  case SessionState.SESSION_STARTED:
                    option.onStateChange?.('connected');
                    updateCastButton('connected');
                    break;
                  case SessionState.SESSION_ENDING:
                    option.onStateChange?.('disconnecting');
                    updateCastButton('disconnecting');
                    break;
                  case SessionState.SESSION_RESUMED:
                    option.onStateChange?.('connected');
                    updateCastButton('connected');
                    break;
                }
              },
            );

            // Listen for cast state changes
            context.addEventListener(
              window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
              (event) => {
                const CastState = window.cast.framework.CastState;
                switch (event.castState) {
                  case CastState.NO_DEVICES_AVAILABLE:
                    option.onCastAvailable?.(false);
                    break;
                  case CastState.NOT_CONNECTED:
                    option.onCastAvailable?.(true);
                    break;
                  case CastState.CONNECTING:
                  case CastState.CONNECTED:
                    option.onCastAvailable?.(true);
                    break;
                }
              },
            );

            isCastInitialized = true;
            resolve();
          } catch (error) {
            reject(
              new Error(`Cast API initialization failed: ${error.message}`),
            );
          }
        } else {
          reject(new Error('Cast API is not available'));
        }
      };

      // 修复 API 加载逻辑
      if (!window.chrome || !window.chrome.cast || !window.cast) {
        console.log('Loading Cast API...');
        loadScript(option.sdk || DEFAULT_SDK).catch(reject);
      } else if (window.cast && window.cast.framework) {
        // API 已加载，直接初始化
        window.__onGCastApiAvailable(true);
      } else {
        // API 已加载但框架未就绪，等待
        setTimeout(() => {
          if (window.cast && window.cast.framework) {
            window.__onGCastApiAvailable(true);
          } else {
            reject(new Error('Cast framework not ready'));
          }
        }, 1000);
      }
    });
  };

  const castVideo = (art, session) => {
    const url = option.url || art.option.url;
    const mediaInfo = new window.chrome.cast.media.MediaInfo(
      url,
      option.mimeType || getMimeType(url),
    );
    const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
    session
      .loadMedia(request)
      .then(() => {
        art.notice.show = 'Casting started';
        option.onCastStart?.();
      })
      .catch((error) => {
        art.notice.show = 'Error casting media';
        option.onError?.(error);
        throw error;
      });
  };

  return async (art) => {
    // 像ArtPlayer的AirPlay一样，检查浏览器支持再决定是否添加按钮
    // 检查是否为Chrome浏览器且不是iOS
    const userAgent =
      typeof navigator !== 'undefined' ? navigator.userAgent : '';

    // 详细调试日志
    console.log('🔍 Chromecast Plugin Debug:', {
      userAgent: userAgent,
      hasChrome: /Chrome/i.test(userAgent),
      hasEdg: /Edg/i.test(userAgent),
      hasOPR: /OPR/i.test(userAgent),
      hasSamsung: /SamsungBrowser/i.test(userAgent),
      hasOPPO: /OPPO/i.test(userAgent),
      hasOppoBrowser: /OppoBrowser/i.test(userAgent),
      hasHeyTapBrowser: /HeyTapBrowser/i.test(userAgent),
      hasColorOS: /ColorOS/i.test(userAgent),
      hasOneplus: /OnePlus/i.test(userAgent),
      hasXiaomi: /Xiaomi/i.test(userAgent),
      hasMIUI: /MIUI/i.test(userAgent),
      hasHuawei: /Huawei/i.test(userAgent),
      hasVivo: /Vivo/i.test(userAgent),
      hasUC: /UCBrowser/i.test(userAgent),
      hasQQ: /QQBrowser/i.test(userAgent),
      hasBaidu: /Baidu/i.test(userAgent),
      hasSogou: /SogouMobileBrowser/i.test(userAgent),
    });

    const isChrome =
      /Chrome/i.test(userAgent) &&
      !/Edg/i.test(userAgent) && // 排除Edge
      !/OPR/i.test(userAgent) && // 排除Opera
      !/SamsungBrowser/i.test(userAgent) && // 排除三星浏览器
      !/OPPO/i.test(userAgent) && // 排除OPPO浏览器
      !/OppoBrowser/i.test(userAgent) && // 排除OppoBrowser
      !/HeyTapBrowser/i.test(userAgent) && // 排除HeyTapBrowser (OPPO新版浏览器)
      !/ColorOS/i.test(userAgent) && // 排除ColorOS浏览器
      !/OnePlus/i.test(userAgent) && // 排除OnePlus浏览器
      !/Xiaomi/i.test(userAgent) && // 排除小米浏览器
      !/MIUI/i.test(userAgent) && // 排除MIUI浏览器
      !/Huawei/i.test(userAgent) && // 排除华为浏览器
      !/Vivo/i.test(userAgent) && // 排除Vivo浏览器
      !/UCBrowser/i.test(userAgent) && // 排除UC浏览器
      !/QQBrowser/i.test(userAgent) && // 排除QQ浏览器
      !/Baidu/i.test(userAgent) && // 排除百度浏览器
      !/SogouMobileBrowser/i.test(userAgent); // 排除搜狗浏览器

    const isIOS = /iPad|iPhone|iPod/i.test(userAgent) && !window.MSStream;

    console.log('🎯 Chromecast Detection Result:', {
      isChrome: isChrome,
      isIOS: isIOS,
      shouldShowChromecast: isChrome && !isIOS,
    });

    // 如果不是Chrome浏览器或者是iOS，直接返回空插件，不添加任何控件
    if (!isChrome || isIOS) {
      console.log(
        '❌ Chromecast plugin: Browser not supported, skipping control addition',
      );
      return {
        name: 'artplayerPluginChromecast',
        getCastState: () => null,
        isCasting: () => false,
      };
    }

    console.log(
      '✅ Chromecast plugin: Adding control button for supported browser',
    );

    art.controls.add({
      name: 'chromecast',
      position: 'right',
      index: 45, // 放在pip(40)和airplay(50)之间，确保不会挤掉全屏按钮
      tooltip: 'Chromecast',
      html: `<i class="art-icon art-icon-cast">${
        option.icon || DEFAULT_ICON
      }</i>`,
      click: async () => {
        if (!isCastInitialized) {
          try {
            await initializeCastApi();
          } catch (error) {
            art.notice.show = 'Failed to initialize Cast API';
            option.onError?.(error);
            throw error;
          }
        }

        const context = window.cast.framework.CastContext.getInstance();
        if (castSession) {
          castVideo(art, castSession);
        } else {
          try {
            const session = await context.requestSession();
            castVideo(art, session);
          } catch (error) {
            art.notice.show = 'Error connecting to cast session';
            option.onError?.(error);
            throw error;
          }
        }
      },
    });

    return {
      name: 'artplayerPluginChromecast',
      getCastState: () => castState,
      isCasting: () => castSession !== null,
    };
  };
}

if (typeof window !== 'undefined') {
  window.artplayerPluginChromecast = artplayerPluginChromecast;
}
