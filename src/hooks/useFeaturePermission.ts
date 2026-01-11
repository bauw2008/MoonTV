import { useCallback, useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

export type FeatureType =
  | 'ai-recommend'
  | 'disable-yellow-filter'
  | 'netdisk-search'
  | 'tmdb-actor-search';

interface FeaturePermissions {
  'ai-recommend': boolean;
  'disable-yellow-filter': boolean;
  'netdisk-search': boolean;
  'tmdb-actor-search': boolean;
}

export function useFeaturePermission() {
  const [permissions, setPermissions] = useState<FeaturePermissions>({
    'ai-recommend': false,
    'disable-yellow-filter': false,
    'netdisk-search': false,
    'tmdb-actor-search': false,
  });
  const [loading, setLoading] = useState(true);

  const checkPermission = useCallback(
    async (feature: FeatureType): Promise<boolean> => {
      try {
        const authInfo = getAuthInfoFromBrowserCookie();
        if (!authInfo || !authInfo.username) {
          return false;
        }

        const response = await fetch(
          `/api/check-permission?feature=${feature}`,
          {
            headers: {
              'Cache-Control': 'no-cache',
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          return data.hasPermission || false;
        }

        return false;
      } catch (error) {
        console.error(`Failed to check permission for ${feature}:`, error);
        return false;
      }
    },
    [],
  );

  const hasPermission = useCallback(
    (feature: FeatureType): boolean => {
      return permissions[feature];
    },
    [permissions],
  );

  const refreshPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const features: FeatureType[] = [
        'ai-recommend',
        'disable-yellow-filter',
        'netdisk-search',
        'tmdb-actor-search',
      ];

      const results = await Promise.all(
        features.map(async (feature) => ({
          feature,
          hasPermission: await checkPermission(feature),
        })),
      );

      const newPermissions: Partial<FeaturePermissions> = {};
      results.forEach(({ feature, hasPermission }) => {
        newPermissions[feature] = hasPermission;
      });

      setPermissions((prev) => ({
        ...prev,
        ...newPermissions,
      }));
    } catch (error) {
      console.error('Failed to refresh permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [checkPermission]);

  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  return {
    permissions,
    hasPermission,
    loading,
    refreshPermissions,
  };
}
