"use client";
import React from "react";
import useToolsStore from "@/stores/useToolsStore";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";

export default function McpConfig() {
  const { mcpConfig, setMcpConfig } = useToolsStore();

  const handleClear = () => {
    setMcpConfig({
      server_label: "",
      server_url: "",
      allowed_tools: "",
      skip_approval: false,
      auth_type: "none",
      bearer_token: "",
      custom_headers: "",
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-zinc-600 text-sm">Server details</div>
        <div
          className="text-zinc-400 text-sm px-1 transition-colors hover:text-zinc-600 cursor-pointer"
          onClick={handleClear}
        >
          Clear
        </div>
      </div>
      <div className="mt-3 space-y-3 text-zinc-400">
        <div className="flex items-center gap-2">
          <label htmlFor="server_label" className="text-sm w-24">
            Label
          </label>
          <Input
            id="server_label"
            type="text"
            placeholder="deepwiki"
            className="bg-white border text-sm flex-1 text-zinc-900 placeholder:text-zinc-400"
            value={mcpConfig.server_label}
            onChange={(e) =>
              setMcpConfig({ ...mcpConfig, server_label: e.target.value })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="server_url" className="text-sm w-24">
            URL
          </label>
          <Input
            id="server_url"
            type="text"
            placeholder="https://example.com/mcp"
            className="bg-white border text-sm flex-1 text-zinc-900 placeholder:text-zinc-400"
            value={mcpConfig.server_url}
            onChange={(e) =>
              setMcpConfig({ ...mcpConfig, server_url: e.target.value })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="allowed_tools" className="text-sm w-24">
            Allowed
          </label>
          <Input
            id="allowed_tools"
            type="text"
            placeholder="tool1,tool2"
            className="bg-white border text-sm flex-1 text-zinc-900 placeholder:text-zinc-400"
            value={mcpConfig.allowed_tools}
            onChange={(e) =>
              setMcpConfig({ ...mcpConfig, allowed_tools: e.target.value })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="auth_type" className="text-sm w-24">
            Auth Type
          </label>
          <select
            id="auth_type"
            className="bg-white border text-sm flex-1 text-zinc-900 rounded-md px-3 py-1.5"
            value={mcpConfig.auth_type || "none"}
            onChange={(e) =>
              setMcpConfig({ ...mcpConfig, auth_type: e.target.value as 'none' | 'bearer' | 'custom_headers' })
            }
          >
            <option value="none">None</option>
            <option value="bearer">Bearer Token</option>
            <option value="custom_headers">Custom Headers</option>
          </select>
        </div>
        {mcpConfig.auth_type === "bearer" && (
          <div className="flex items-center gap-2">
            <label htmlFor="bearer_token" className="text-sm w-24">
              Bearer Token
            </label>
            <Input
              id="bearer_token"
              type="password"
              placeholder="Enter bearer token"
              className="bg-white border text-sm flex-1 text-zinc-900 placeholder:text-zinc-400"
              value={mcpConfig.bearer_token || ""}
              onChange={(e) =>
                setMcpConfig({ ...mcpConfig, bearer_token: e.target.value })
              }
            />
          </div>
        )}
        {mcpConfig.auth_type === "custom_headers" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <label htmlFor="custom_headers" className="text-sm w-24 mt-2">
                Headers
              </label>
              <Textarea
                id="custom_headers"
                placeholder='{"Authorization": "Bearer token", "X-API-Key": "key"}'
                className="bg-white border text-sm flex-1 text-zinc-900 placeholder:text-zinc-400 min-h-[80px] font-mono text-xs"
                value={mcpConfig.custom_headers || ""}
                onChange={(e) =>
                  setMcpConfig({ ...mcpConfig, custom_headers: e.target.value })
                }
              />
            </div>
            <div className="ml-[6.5rem] text-xs text-zinc-500">
              Enter headers as JSON format
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label htmlFor="skip_approval" className="text-sm w-24">
            Skip approval
          </label>
          <Switch
            id="skip_approval"
            checked={mcpConfig.skip_approval}
            onCheckedChange={(checked) =>
              setMcpConfig({ ...mcpConfig, skip_approval: checked })
            }
          />
        </div>
      </div>
    </div>
  );
}
