import { ActionIcon, Button, Container, Divider, Group, Modal, Text } from "@mantine/core";
import { IconSettings, IconTrash } from "@tabler/icons-react";
import { QueryClient } from "@tanstack/query-core";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

import { useStorage } from "@plasmohq/storage/dist/hook";

import AliasList from "~components/AliasList";
import Login from "~components/Login";
import Settings from "~components/Settings";
import { StorageKey, popupHeight, popupWidth } from "~const";
import { ThemeProvider } from "~popup/Theme";

const queryClient = new QueryClient();

function Popup() {
  const [token] = useStorage<string>(StorageKey.ApiToken, null);
  const [reactQueryDevtoolsEnabled] = useStorage<boolean>(
    StorageKey.ReactQueryDevtoolsEnabled,
    false,
  );
  const [settingsModalOpened, setSettingsModalOpened] = useState(false);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {reactQueryDevtoolsEnabled && <ReactQueryDevtools initialIsOpen={false} />}
        <Container w={popupWidth} h={popupHeight} p={0}>
          <Modal
            opened={settingsModalOpened}
            onClose={() => setSettingsModalOpened(false)}
            title="Settings"
            fullScreen>
            <Settings />
          </Modal>
          <Group position="apart" px="lg" py="md">
            <Text fw="bold" size="md">
              MailFlare
            </Text>
            <ActionIcon variant="subtle" size="md" onClick={() => setSettingsModalOpened(true)}>
              <IconSettings size={16} />
            </ActionIcon>
          </Group>
          <Divider />
          {token && <AliasList />}
          {!token && <Login />}
        </Container>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default Popup;
