import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Loader,
  ScrollArea,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { showNotification } from "@mantine/notifications";
import {
  IconClipboard,
  IconEdit,
  IconListCheck,
  IconPlaylistAdd,
  IconPlaylistX,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useState } from "react";

import AliasBulkDeleteModal from "~components/AliasBulkDeleteModal";
import AliasBulkEditModal from "~components/AliasBulkEditModal";
import AliasCreateModal from "~components/AliasCreateModal";
import AliasDeleteModal from "~components/AliasDeleteModal";
import AliasEditModal from "~components/AliasEditModal";
import { emailRuleNamePrefix, popupHeight } from "~const";
import {
  CloudflareEmailRule,
  destinationsStatusAtom,
  emailRulesStatusAtom,
  zonesStatusAtom,
} from "~utils/cloudflare";
import { selectedZoneIdAtom } from "~utils/state";

// popupHeight - header - divider - padding - select - button group - gap
const aliasListHeight = popupHeight - 52 - 1 - 16 * 2 - 36 - 26 - 10 * 2;

function AliasList() {
  const clipboard = useClipboard();

  const [zones] = useAtom(zonesStatusAtom);
  const [destinations] = useAtom(destinationsStatusAtom);
  const [emailRules, emailRulesDispatch] = useAtom(emailRulesStatusAtom);

  const [selectedZoneId, setSelectedZoneId] = useAtom(selectedZoneIdAtom);

  const [aliasCreateModalOpened, setAliasCreateModalOpened] = useState(false);
  const [aliasEditModalOpened, setAliasEditModalOpened] = useState(false);
  const [aliasDeleteModalOpened, setAliasDeleteModalOpened] = useState(false);
  const [aliasSelectEnabled, setAliasSelectEnabled] = useState(false);

  const [selectedAliases, setSelectedAliases] = useState<CloudflareEmailRule[]>([]);
  const [aliasToEdit, setAliasToEdit] = useState<CloudflareEmailRule | null>(null);
  const [aliasToDelete, setAliasToDelete] = useState<CloudflareEmailRule | null>(null);

  function getAliasBadge(rule: CloudflareEmailRule) {
    const destination = destinations.data?.find((d) => rule.actions[0].value[0] === d.email);
    if (
      destinations.data &&
      destinations.data.length > 0 &&
      (!destination || destination.verified === null)
    ) {
      return (
        <Badge color="red" variant="filled" size="xs">
          Invalid
        </Badge>
      );
    }
    if (!rule.name.startsWith(emailRuleNamePrefix)) {
      return (
        <Badge color="blue" size="xs">
          External
        </Badge>
      );
    }
    if (!rule.enabled) {
      return (
        <Badge color="red" size="xs">
          Disabled
        </Badge>
      );
    }
  }

  return (
    <Stack p="md" spacing="xs">
      <AliasCreateModal
        opened={aliasCreateModalOpened}
        onClose={() => setAliasCreateModalOpened(false)}
      />

      <AliasEditModal
        opened={aliasEditModalOpened && !!aliasToEdit && selectedAliases.length === 0}
        onClose={() => {
          setAliasEditModalOpened(false);
          setAliasToEdit(null);
        }}
        aliasToEdit={aliasToEdit!}
      />

      <AliasBulkEditModal
        opened={aliasEditModalOpened && selectedAliases.length > 0}
        onClose={(clear) => {
          setAliasEditModalOpened(false);
          if (clear) {
            setAliasSelectEnabled(false);
            setSelectedAliases([]);
          }
        }}
        selectedAliases={selectedAliases}
      />

      <AliasDeleteModal
        opened={aliasDeleteModalOpened && !!aliasToDelete && selectedAliases.length === 0}
        onClose={() => {
          setAliasDeleteModalOpened(false);
          setAliasToDelete(null);
        }}
        aliasToDelete={aliasToDelete!}
      />

      <AliasBulkDeleteModal
        opened={aliasDeleteModalOpened && selectedAliases.length > 0}
        onClose={(clear) => {
          setAliasDeleteModalOpened(false);
          if (clear) {
            setAliasSelectEnabled(false);
            setSelectedAliases([]);
          }
        }}
        selectedAliases={selectedAliases}
      />

      {/* DOMAIN SELECTOR */}
      <Select
        value={selectedZoneId}
        onChange={setSelectedZoneId}
        disabled={!zones.data || zones.data.length === 0}
        rightSection={zones.isFetching ? <Loader size="xs" /> : undefined}
        dropdownPosition="bottom"
        data={
          zones.data?.map((z) => ({
            value: z.id,
            label: z.name,
          })) || []
        }
        placeholder="Domain"
        searchable={zones.isSuccess && zones.data.length > 5}
      />

      {/* ACTION BUTTONS */}
      <Button.Group>
        <Button
          variant="light"
          compact
          fullWidth
          leftIcon={aliasSelectEnabled ? <IconPlaylistX size={16} /> : <IconListCheck size={16} />}
          disabled={!zones.data || zones.data.length === 0 || selectedZoneId === null}
          onClick={() => {
            setSelectedAliases([]);
            setAliasSelectEnabled(!aliasSelectEnabled);
          }}>
          {aliasSelectEnabled ? "Stop Select" : "Select"}
        </Button>
        {aliasSelectEnabled && (
          <>
            <Button
              variant="light"
              compact
              fullWidth
              leftIcon={<IconEdit size={16} />}
              disabled={selectedAliases.length === 0}
              onClick={() => setAliasEditModalOpened(true)}>
              Edit
            </Button>
            <Button
              variant="light"
              color="red"
              compact
              fullWidth
              leftIcon={<IconTrash size={16} />}
              disabled={selectedAliases.length === 0}
              onClick={() => setAliasDeleteModalOpened(true)}>
              Delete
            </Button>
          </>
        )}
        {!aliasSelectEnabled && (
          <>
            <Button
              variant="light"
              compact
              fullWidth
              leftIcon={<IconPlaylistAdd size={16} />}
              disabled={!zones.data || zones.data.length === 0 || selectedZoneId === null}
              onClick={() => setAliasCreateModalOpened(true)}>
              Create
            </Button>
            <Button
              variant="light"
              compact
              fullWidth
              leftIcon={<IconRefresh size={16} />}
              disabled={!zones.data || zones.data.length === 0 || selectedZoneId === null}
              loading={emailRules.isFetching}
              loaderProps={{ size: 16 }}
              onClick={() => emailRulesDispatch({ type: "refetch" })}>
              Refresh
            </Button>
          </>
        )}
      </Button.Group>

      {/* ALIAS LIST AREA */}
      <ScrollArea h={aliasListHeight}>
        <Stack spacing="xs">
          {zones.isSuccess && zones.data.length === 0 && (
            <Alert title="Oh no!" color="red">
              No domains for this Cloudflare account or API token.
            </Alert>
          )}

          {zones.isError && (
            <Alert title="Oh no!" color="red">
              {`Something went wrong while loading your domains: ${zones.error}`}
            </Alert>
          )}

          {!!selectedZoneId && emailRules.isLoading && (
            <Center>
              <Loader height={aliasListHeight - 5} />
            </Center>
          )}

          {!!selectedZoneId && emailRules.isSuccess && emailRules.data.length === 0 && (
            <Alert title="Bummer!" color="yellow">
              There are no aliases for this domain yet.
            </Alert>
          )}

          {emailRules.isError && (
            <Alert title="Oh no!" color="red">
              {`Something went wrong while loading your aliases: ${emailRules.error}`}
            </Alert>
          )}

          {/* ALIAS LIST */}
          {emailRules.isSuccess &&
            emailRules.data.map((r) => (
              <Card
                p="xs"
                radius="sm"
                withBorder
                key={r.tag}
                onClick={() => {
                  if (aliasSelectEnabled) {
                    if (!selectedAliases.includes(r)) {
                      setSelectedAliases([...selectedAliases, r]);
                    } else {
                      setSelectedAliases(selectedAliases.filter((rr) => rr.tag !== r.tag));
                    }
                  }
                }}>
                <Group position="apart">
                  <Group spacing="xs">
                    {aliasSelectEnabled && (
                      <Checkbox
                        size="xs"
                        checked={selectedAliases.includes(r)}
                        onChange={(event) => {
                          if (event.currentTarget.checked) {
                            setSelectedAliases([...selectedAliases, r]);
                          } else {
                            setSelectedAliases(selectedAliases.filter((rr) => rr.tag !== r.tag));
                          }
                        }}
                      />
                    )}

                    <Text weight={500} truncate style={{ width: aliasSelectEnabled ? 230 : 260 }}>
                      {r.matchers[0].value}
                    </Text>
                  </Group>

                  <Button.Group>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      onClick={() => {
                        clipboard.copy(r.matchers[0].value);
                        showNotification({
                          color: "green",
                          message: "Email address was copied to the clipboard.",
                          autoClose: 2000,
                        });
                      }}>
                      <IconClipboard size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      disabled={aliasSelectEnabled}
                      onClick={() => {
                        setAliasToEdit(r);
                        setAliasEditModalOpened(true);
                      }}>
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      disabled={aliasSelectEnabled}
                      onClick={() => {
                        setAliasToDelete(r);
                        setAliasDeleteModalOpened(true);
                      }}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Button.Group>
                </Group>

                <Group position="apart" ml={aliasSelectEnabled ? 26 : 0}>
                  <Text
                    size="sm"
                    color="dimmed"
                    truncate
                    style={{ width: aliasSelectEnabled ? 240 : 265 }}>
                    {r.name.replace(emailRuleNamePrefix, "").trim() || "(no description)"}
                  </Text>
                  {getAliasBadge(r)}
                </Group>
              </Card>
            ))}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

export default AliasList;
