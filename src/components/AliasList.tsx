import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useClipboard } from "@mantine/hooks";
import { showNotification } from "@mantine/notifications";
import { IconClipboard, IconEdit, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ParseResultType, parseDomain } from "parse-domain";
import { useEffect, useState } from "react";

import { useStorage } from "@plasmohq/storage/dist/hook";

import Settings from "~components/Settings";
import { StorageKey, emailRuleNamePrefix, popupHeight } from "~const";
import { generateAlias } from "~utils/alias";
import {
  CloudflareApiBaseUrl,
  CloudflareCreateEmailRuleResponse,
  CloudflareEmailDestination,
  CloudflareEmailRule,
  CloudflareListEmailDestinationsResponse,
  CloudflareListEmailRulesResponse,
  CloudflareListZonesResponse,
  CloudflareZone,
} from "~utils/cloudflare";

const aliasListHeight = 400;

function AliasList() {
  const queryClient = useQueryClient();
  const clipboard = useClipboard();

  const [hostname, setHostname] = useState("");
  const [hostnameDomain, setHostnameDomain] = useState("");

  const [token] = useStorage<string>(StorageKey.ApiToken, null);
  const [destinations, setDestinations] = useStorage<CloudflareEmailDestination[]>(
    StorageKey.Destinations,
    [],
  );
  const [zones, setZones] = useStorage<CloudflareZone[]>(StorageKey.Zones, []);
  const [accountId, setAccountId] = useStorage<string>(StorageKey.AccountIdentifier, null);

  const [selectedZoneId, setSelectedZoneId] = useStorage<string>(StorageKey.SelectedZoneId, "");
  const [onlyShowExtensionRules, setOnlyShowExtensionRules] = useStorage<boolean>(
    StorageKey.OnlyShowExtensionRules,
    true,
  );
  const [aliasSettings, setAliasSettings] = useStorage<{
    format?: string;
    characterCount?: number;
    wordCount?: number;
    separator?: string;
    prefixWithHost?: boolean;
    // destination?: "",
  }>(StorageKey.AliasSettings, {});

  const [aliasCreateModalOpened, setAliasCreateModalOpened] = useState(false);
  const [aliasEditModalOpened, setAliasEditModalOpened] = useState(false);
  const [aliasDeleteModalOpened, setAliasDeleteModalOpened] = useState(false);
  const [aliasToDelete, setAliasToDelete] = useState<CloudflareEmailRule>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true }).then(([tab]) => {
      if (tab && tab.url) {
        const url = new URL(tab.url);
        setHostname(url.hostname.replace("www.", ""));

        const parsed = parseDomain(url.hostname);
        if (parsed.type === ParseResultType.Listed) {
          setHostnameDomain(parsed.domain);
        }
      }
    });
  }, []);

  const { status: zonesStatus, error: zonesError } = useQuery(
    ["zones"],
    async () => {
      const response = await fetch(`${CloudflareApiBaseUrl}/zones`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json: CloudflareListZonesResponse = await response.json();
      if (response.ok && json.success) {
        await setZones(json.result);
        if (json.result.length > 0) {
          await setAccountId(json.result[0].account.id);
          if (selectedZoneId === "") {
            await setSelectedZoneId(json.result[0].id);
          }
        }
        return json.result;
      }
      console.error(json);
      throw new Error(json.errors[0].message);
    },
    { enabled: token !== null, retry: 1 },
  );

  const { status: destinationsStatus, error: destinationsError } = useQuery(
    ["destinations"],
    async () => {
      const response = await fetch(
        `${CloudflareApiBaseUrl}/accounts/${accountId}/email/routing/addresses`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const json: CloudflareListEmailDestinationsResponse = await response.json();
      if (response.ok && json.success) {
        await setDestinations(json.result);
        return json.result;
      }
      console.error(json);
      throw new Error(json.errors[0].message);
    },
    { enabled: accountId !== null, retry: 1 },
  );

  const {
    status: rulesStatus,
    error: rulesError,
    data: rules,
  } = useQuery(
    ["emailRules", selectedZoneId],
    async ({ queryKey }) => {
      const response = await fetch(
        `${CloudflareApiBaseUrl}/zones/${queryKey[1]}/email/routing/rules`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const json: CloudflareListEmailRulesResponse = await response.json();
      if (response.ok && json.success) {
        if (onlyShowExtensionRules) {
          return json.result.filter(
            (r) =>
              r.name.toLowerCase().startsWith(emailRuleNamePrefix) &&
              r.matchers[0].type === "literal" &&
              r.actions[0].type === "forward",
          );
        }
        return json.result;
      }
      console.error(json);
      throw new Error(json.errors[0].message);
    },
    { enabled: !!zones && zones.length > 0 && selectedZoneId !== "", retry: 1 },
  );

  const aliasCreateForm = useForm({
    initialValues: {
      zoneId: selectedZoneId,
      format: "characters",
      characterCount: 5,
      wordCount: 2,
      separator: "_",
      customAlias: "",
      description: "",
      prefixWithHost: false,
      destination: "",
    },
  });

  const createMutation = useMutation(
    async (variables: typeof aliasCreateForm.values) => {
      let alias: string;
      if (variables.format === "custom") {
        alias = variables.customAlias;
      } else {
        alias = generateAlias(
          variables.format === "words" ? "words" : "characters",
          variables.characterCount,
          variables.wordCount,
          variables.separator,
          variables.prefixWithHost ? hostnameDomain || hostname : null,
        );
      }
      alias = `${alias}@${zones.find((z) => z.id === variables.zoneId).name}`;

      const rule: CloudflareEmailRule = {
        actions: [
          {
            type: "forward",
            value: [variables.destination],
          },
        ],
        matchers: [
          {
            field: "to",
            type: "literal",
            value: alias,
          },
        ],
        enabled: true,
        name: `${emailRuleNamePrefix}${variables.description}`,
        priority: Math.round(Date.now() / 1000),
      };

      console.log(rule);

      const response = await fetch(
        `${CloudflareApiBaseUrl}/zones/${variables.zoneId}/email/routing/rules`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(rule),
        },
      );
      const json: CloudflareCreateEmailRuleResponse = await response.json();
      if (response.ok && json.success) {
        await setSelectedZoneId(variables.zoneId);
        await setAliasSettings({
          format: variables.format,
          characterCount: variables.characterCount,
          wordCount: variables.wordCount,
          separator: variables.separator,
          prefixWithHost: variables.prefixWithHost,
        });
        setAliasCreateModalOpened(false);
        aliasCreateForm.reset();
        clipboard.copy(alias);
        showNotification({
          color: "green",
          title: "Success!",
          message: "The alias was created and copied to your clipboard!",
          autoClose: 3000,
        });
        return json.result;
      }
      console.error(json);
      showNotification({
        color: "red",
        title: "Error",
        message: json.errors[0].message,
        autoClose: false,
      });
      throw new Error(json.errors[0].message);
    },
    {
      onSuccess: (data, variables) => {
        return queryClient.invalidateQueries({ queryKey: ["emailRules", variables.zoneId] });
      },
    },
  );

  const aliasEditForm = useForm({
    initialValues: {
      id: "",
      zoneId: "",
      alias: "",
      description: "",
      enabled: true,
    },
  });

  const editMutation = useMutation(
    async (variables: typeof aliasEditForm.values) => {
      const original = rules.find((r) => r.tag === variables.id);
      const updated: CloudflareEmailRule = {
        ...original,
        name: `${emailRuleNamePrefix}${variables.description}`,
        enabled: variables.enabled,
      };
      const response = await fetch(
        `${CloudflareApiBaseUrl}/zones/${variables.zoneId}/email/routing/rules/${variables.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updated),
        },
      );
      const json: CloudflareCreateEmailRuleResponse = await response.json();
      if (response.ok && json.success) {
        setAliasEditModalOpened(false);
        aliasEditForm.reset();
        showNotification({
          color: "green",
          title: "Success!",
          message: "The alias was updated!",
          autoClose: 3000,
        });
        return json.result;
      }
      console.error(json);
      showNotification({
        color: "red",
        title: "Error",
        message: json.errors[0].message,
        autoClose: false,
      });
      throw new Error(json.errors[0].message);
    },
    {
      onSuccess: (data, variables) => {
        return queryClient.invalidateQueries({ queryKey: ["emailRules", variables.zoneId] });
      },
    },
  );

  const deleteMutation = useMutation(
    async (variables: { id: string; zoneId: string }) => {
      const response = await fetch(
        `${CloudflareApiBaseUrl}/zones/${variables.zoneId}/email/routing/rules/${variables.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      const json: CloudflareCreateEmailRuleResponse = await response.json();
      if (response.ok && json.success) {
        showNotification({
          color: "green",
          title: "Success!",
          message: "The alias was deleted!",
          autoClose: 3000,
        });
        return json.result;
      }
      console.error(json);
      showNotification({
        color: "red",
        title: "Error",
        message: json.errors[0].message,
        autoClose: false,
      });
      throw new Error(json.errors[0].message);
    },
    {
      onSuccess: (data, variables) => {
        return queryClient.invalidateQueries({ queryKey: ["emailRules", variables.zoneId] });
      },
    },
  );

  return (
    <Stack p="lg" spacing="xs">
      <Select
        value={selectedZoneId}
        onChange={setSelectedZoneId}
        disabled={zones.length === 0}
        data={zones.map((z) => ({
          value: z.id,
          label: z.name,
        }))}
      />

      <Modal
        opened={aliasCreateModalOpened}
        onClose={() => {
          if (createMutation.isLoading) {
            showNotification({
              color: "red",
              message: "Cannot be closed right now.",
              autoClose: 2000,
            });
            return;
          }
          setAliasCreateModalOpened(false);
          aliasCreateForm.reset();
        }}
        title="Create alias"
        fullScreen>
        <form onSubmit={aliasCreateForm.onSubmit((values) => createMutation.mutate(values))}>
          <Stack spacing="xs">
            <Select
              label="Domain"
              data={zones.map((z) => ({
                value: z.id,
                label: z.name,
              }))}
              {...aliasCreateForm.getInputProps("zoneId")}
            />
            <Select
              label="Format"
              data={[
                {
                  value: "characters",
                  label: "Random characters",
                },
                {
                  value: "words",
                  label: "Random words",
                },
                {
                  value: "custom",
                  label: "Custom",
                },
              ]}
              {...aliasCreateForm.getInputProps("format")}
            />

            {aliasCreateForm.values.format === "characters" && (
              <NumberInput
                defaultValue={5}
                label="Number of characters"
                {...aliasCreateForm.getInputProps("characterCount")}
              />
            )}

            {aliasCreateForm.values.format === "words" && (
              <NumberInput
                defaultValue={3}
                label="Number of words"
                {...aliasCreateForm.getInputProps("wordCount")}
              />
            )}

            {aliasCreateForm.values.format === "custom" && (
              <TextInput label="Custom alias" {...aliasCreateForm.getInputProps("customAlias")} />
            )}

            <TextInput label="Description" {...aliasCreateForm.getInputProps("description")} />

            {(aliasCreateForm.values.format === "characters" ||
              aliasCreateForm.values.format === "words") && (
              <Switch
                label="Prefix alias with website name"
                {...aliasCreateForm.getInputProps("prefixWithHost")}
              />
            )}

            <Select
              label="Destination"
              data={destinations.map((z) => ({
                value: z.email,
                label: z.email,
              }))}
              {...aliasCreateForm.getInputProps("destination")}
            />

            <Button type="submit" loading={createMutation.status === "loading"}>
              Create
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={aliasEditModalOpened}
        onClose={() => {
          if (editMutation.isLoading) {
            showNotification({
              color: "red",
              message: "Cannot be closed right now.",
              autoClose: 2000,
            });
            return;
          }
          setAliasEditModalOpened(false);
        }}
        title="Edit Alias"
        fullScreen>
        <form onSubmit={aliasEditForm.onSubmit((values) => editMutation.mutate(values))}>
          <Stack spacing="xs">
            <TextInput label="Alias" disabled {...aliasEditForm.getInputProps("alias")} />
            <TextInput label="Description" {...aliasEditForm.getInputProps("description")} />
            <Switch
              label="Enabled"
              {...aliasEditForm.getInputProps("enabled", { type: "checkbox" })}
            />
            <Button type="submit" loading={editMutation.status === "loading"}>
              Save
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={aliasDeleteModalOpened}
        onClose={() => {
          if (deleteMutation.isLoading) {
            showNotification({
              color: "red",
              message: "Cannot be closed right now.",
              autoClose: 2000,
            });
            return;
          }
          setAliasDeleteModalOpened(false);
        }}
        title="Delete Alias"
        fullScreen>
        <Stack spacing="xs">
          <Text>
            Do you want to delete the alias {aliasToDelete?.matchers[0].value}? This cannot be
            undone.
          </Text>
          <Group position="center" spacing="sm">
            <Button
              color="green"
              onClick={() => {
                setAliasDeleteModalOpened(false);
                setAliasToDelete(null);
              }}>
              No
            </Button>
            <Button
              color="red"
              onClick={() => {
                setAliasDeleteModalOpened(false);
                setAliasToDelete(null);
                deleteMutation.mutate({ id: aliasToDelete?.tag, zoneId: selectedZoneId });
              }}>
              Yes
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ScrollArea style={{ height: aliasListHeight }}>
        {zonesStatus === "success" && zones.length === 0 && (
          <Alert title="Oh no!" color="yellow">
            No domains for this Cloudflare account or API token.
          </Alert>
        )}

        {zonesStatus === "error" && (
          <Alert title="Oh no!" color="red">
            {`Something went wrong while loading your domains: ${zonesError}`}
          </Alert>
        )}

        {rulesStatus === "loading" && (
          <Center>
            <Loader height={aliasListHeight} />
          </Center>
        )}

        {rulesStatus === "success" && (
          <Stack spacing="xs" pb={5}>
            {rules.map((r) => (
              <Card shadow="xs" p="xs" radius="sm" withBorder key={r.tag}>
                <Group position="apart">
                  <Text weight={500} truncate style={{ width: 250 }}>
                    {r.matchers[0].type === "all"
                      ? `*@${zones.find((z) => z.id === selectedZoneId).name}`
                      : r.matchers[0].value}
                  </Text>

                  {r.matchers[0].type !== "all" && (
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
                        disabled={deleteMutation.isLoading}
                        onClick={() => {
                          console.log(r);
                          aliasEditForm.setValues(() => ({
                            id: r.tag,
                            zoneId: selectedZoneId,
                            alias: r.matchers[0].value,
                            description: r.name.replace(emailRuleNamePrefix, "").trim(),
                            enabled: r.enabled,
                          }));
                          setAliasEditModalOpened(true);
                        }}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        loading={deleteMutation.isLoading}
                        onClick={() => {
                          setAliasToDelete(r);
                          setAliasDeleteModalOpened(true);
                        }}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Button.Group>
                  )}
                </Group>

                <Group position="apart">
                  <Text size="sm" color="dimmed" truncate style={{ width: 250 }}>
                    {r.name === "" && r.matchers[0].type === "all"
                      ? "Catch-All"
                      : r.name.replace(emailRuleNamePrefix, "").trim()}
                  </Text>
                  <Badge color={r.enabled ? "green" : "red"} variant="light" size="xs">
                    {r.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </Group>
              </Card>
            ))}
          </Stack>
        )}

        {rulesStatus === "success" && rules.length === 0 && (
          <Alert title="Bummer!" color="yellow">
            There are no aliases for this domain yet.
          </Alert>
        )}

        {rulesStatus === "error" && (
          <Alert title="Oh no!" color="red">
            {`Something went wrong while loading your aliases: ${rulesError}`}
          </Alert>
        )}
      </ScrollArea>

      <Button
        variant="outline"
        fullWidth
        disabled={zones.length === 0}
        onClick={() => {
          aliasCreateForm.setValues({
            zoneId: selectedZoneId,
            destination: destinations[0].email,
            description: hostname,
            ...aliasSettings,
          });
          setAliasCreateModalOpened(true);
        }}>
        Create alias
      </Button>
    </Stack>
  );
}

export default AliasList;