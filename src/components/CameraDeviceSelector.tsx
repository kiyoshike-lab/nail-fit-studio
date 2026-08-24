"use client";

import type { CameraInput } from "@/lib/cameraDevices";

type Props = {
  devices: CameraInput[];
  selectedDeviceId: string;
  disabled?: boolean;
  onChange: (deviceId: string) => void;
};

export function CameraDeviceSelector({ devices, selectedDeviceId, disabled, onChange }: Props) {
  if (devices.length < 2) return null;
  const value = devices.some((device) => device.deviceId === selectedDeviceId)
    ? selectedDeviceId
    : devices[0]?.deviceId ?? "";

  return (
    <section className="panel-card camera-device-card" aria-labelledby="camera-device-title">
      <label htmlFor="camera-device-select" id="camera-device-title">使用するカメラ</label>
      <select
        id="camera-device-select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
        ))}
      </select>
      <p className="hint">USBカメラを接続・取り外すと、この一覧は自動で更新されます。</p>
    </section>
  );
}
