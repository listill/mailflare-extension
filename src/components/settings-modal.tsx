import { Fragment, type ReactNode, useState } from "react";
import type { Locales } from "~i18n/i18n-types";

import {
  Button,
  Divider,
  Flex,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  VisuallyHidden,
  rem,
  useMantineColorScheme,
} from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { IconDeviceDesktop, IconExternalLink, IconMoonStars, IconSun } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";

import LogoutModal from "~components/logout-modal";
import { extensionName, extensionVersion, isWebApp } from "~const";
import { useI18nContext } from "~i18n/i18n-react";
import { loadLocaleAsync } from "~i18n/i18n-util.async";
import { useCloudflare } from "~lib/cloudflare/use-cloudflare";
import { useFullscreenModal } from "~utils";
import { apiTokenAtom, settingsAtom } from "~utils/state";

type SettingsModalProps = {
  opened: boolean;
  onClose: () => void;
};

type SettingsItem = {
  title: string;
  description?: string;
  action: ReactNode;
  requiresAuth?: boolean;
  hide?: boolean;
};

function SettingsModal({ opened, onClose }: SettingsModalProps) {
  const { LL, locale, setLocale } = useI18nContext();
  const queryClient = useQueryClient();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const isFullscreen = useFullscreenModal();

  const { zones, emailDestinations } = useCloudflare();

  const [apiToken, setToken] = useAtom(apiTokenAtom);
  const [settings, setSettings] = useAtom(settingsAtom);

  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const clearCache = async () => {
    await queryClient.invalidateQueries();
    showNotification({
      color: "green",
      message: LL.REFRESH_DATA_SUCCESS(),
      autoClose: 3000,
    });
  };

  const onLocaleSelected = async (value: string | null) => {
    const locale = value as Locales;
    localStorage.setItem("lang", locale);
    await loadLocaleAsync(locale);
    setLocale(locale);
  };

  const themeIconProps = {
    style: { width: rem(16), height: rem(16), display: "block" },
  };

  const settingsItems: SettingsItem[] = [
    {
      title: LL.THEME(),
      description: LL.THEME_DESC(),
      action: (
        <SegmentedControl
          data={[
            {
              value: "light",
              label: (
                <>
                  <IconSun {...themeIconProps} />
                  <VisuallyHidden>{LL.THEME_LIGHT()}</VisuallyHidden>
                </>
              ),
            },
            {
              value: "dark",
              label: (
                <>
                  <IconMoonStars {...themeIconProps} />
                  <VisuallyHidden>{LL.THEME_DARK()}</VisuallyHidden>
                </>
              ),
            },
            {
              value: "auto",
              label: (
                <>
                  <IconDeviceDesktop {...themeIconProps} />
                  <VisuallyHidden>{LL.THEME_AUTO()}</VisuallyHidden>
                </>
              ),
            },
          ]}
          value={colorScheme}
          onChange={(value) => setColorScheme(value as any)}
        />
      ),
    },
    {
      title: LL.LANGUAGE(),
      description: LL.LANGUAGE_DESC(),
      action: (
        <Select
          value={locale}
          onChange={onLocaleSelected}
          allowDeselect={false}
          searchable
          data={[
            { value: "en", label: LL.LANGUAGE_ENGLISH() },
            { value: "de", label: LL.LANGUAGE_GERMAN() },
            { value: "nl", label: LL.LANGUAGE_DUTCH() },
            { value: "zh", label: LL.LANGUAGE_CHINESE() },
          ]}
        />
      ),
    },
    {
      title: LL.RULE_FILTER(),
      description: LL.RULE_FILTER_DESC(),
      hide: !apiToken,
      action: (
        <Switch
          onLabel={LL.ON()}
          offLabel={LL.OFF()}
          size="lg"
          color="green"
          checked={settings.ruleFilter}
          onChange={(event) =>
            setSettings({ ...settings, ruleFilter: event.currentTarget.checked })
          }
        />
      ),
    },
    {
      title: LL.COPY_ALIAS(),
      description: LL.COPY_ALIAS_DESC(),
      hide: !apiToken,
      action: (
        <Switch
          onLabel={LL.ON()}
          offLabel={LL.OFF()}
          color="green"
          size="lg"
          checked={settings.copyAlias}
          onChange={(event) => setSettings({ ...settings, copyAlias: event.currentTarget.checked })}
        />
      ),
    },
    {
      title: LL.QUICK_CREATE_BUTTON(),
      description: LL.QUICK_CREATE_BUTTON_DESC(),
      hide: !apiToken || isWebApp,
      action: (
        <Switch
          onLabel={LL.ON()}
          offLabel={LL.OFF()}
          color="green"
          size="lg"
          checked={settings.showCreateButton}
          onChange={(event) =>
            setSettings({ ...settings, showCreateButton: event.currentTarget.checked })
          }
        />
      ),
    },
    {
      title: LL.REFRESH_DATA(),
      description: LL.REFRESH_DATA_DESC(),
      hide: !apiToken,
      action: (
        <Button
          loading={zones.isFetching || emailDestinations.isFetching}
          onClick={() => clearCache()}>
          {LL.REFRESH()}
        </Button>
      ),
    },
    {
      title: LL.LOGOUT(),
      description: LL.LOGOUT_DESC(),
      hide: !apiToken,
      action: (
        <>
          <LogoutModal
            opened={logoutModalOpen}
            onClose={() => setLogoutModalOpen(false)}
            onLogout={onClose}
          />
          <Button color="red" onClick={() => setLogoutModalOpen(true)}>
            {LL.LOGOUT()}
          </Button>
        </>
      ),
    },
    {
      title: LL.DOCS(),
      description: LL.DOCS_DESC(),
      action: (
        <Button
          component="a"
          href="https://developers.cloudflare.com/email-routing/"
          target="_blank"
          rightSection={<IconExternalLink size={16} />}>
          {LL.OPEN()}
        </Button>
      ),
    },
    {
      title: LL.INFO(),
      description: `${extensionName} v${extensionVersion}`,
      action: (
        <Button
          component="a"
          href="https://github.com/curetix/mailflare-extension"
          target="_blank"
          color="gray"
          rightSection={<IconExternalLink size={16} />}>
          {LL.GITHUB()}
        </Button>
      ),
    },
    {
      title: LL.DEVTOOLS(),
      description: LL.DEVTOOLS_DESC(),
      hide: process.env.NODE_ENV !== "development",
      action: (
        <Switch
          onLabel={LL.ON()}
          offLabel={LL.OFF()}
          size="lg"
          checked={settings.devTools}
          onChange={(event) => setSettings({ ...settings, devTools: event.currentTarget.checked })}
        />
      ),
    },
  ];

  const visibleItems = settingsItems.filter((item) => !item.hide);

  return (
    <Modal
      opened={opened}
      onClose={() => onClose()}
      title={LL.SETTINGS()}
      fullScreen={isFullscreen}>
      <Stack gap="xs" pr={15}>
        {visibleItems.map((item, index) => (
          <Fragment key={item.title}>
            <Flex justify="space-between" align="center" gap="xs">
              <Stack gap={0} flex={1}>
                <Text>{item.title}</Text>
                <Text size="xs" c="dimmed">
                  {item.description}
                </Text>
              </Stack>
              {item.action}
            </Flex>
            {index < visibleItems.length - 1 && <Divider />}
          </Fragment>
        ))}
      </Stack>
    </Modal>
  );
}

export default SettingsModal;
