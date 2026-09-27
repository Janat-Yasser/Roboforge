import type {
  Catalog,
  ComponentDefinition,
  ComponentInstance,
  ControllerFunction,
  Diagnostic,
  PinDef,
  PinType,
  RobotSpec,
} from "@roboforge/spec";

export interface ResolvedComponent {
  instance: ComponentInstance;
  def: ComponentDefinition;
}

export type NetKind = "power" | "ground" | "logic" | "can_h" | "can_l" | "motor" | "ethernet" | "usb" | "nc" | "mixed";

export interface NetPin {
  componentId: string;
  pin: string;
  def: PinDef | undefined;
}

export interface Net {
  id: string;
  /** Human-readable name derived from the most significant pin on the net. */
  name: string;
  kind: NetKind;
  pins: NetPin[];
  connectionIds: string[];
}

/** A controller pin as referenced from generated code. */
export interface ControllerPinRef {
  pin: string;
  codeRef: string;
}

export interface PinAssignment {
  pin: string;
  codeRef: string | undefined;
  netId: string;
  /** Function inferred from what the pin is connected to. */
  fn: ControllerFunction | undefined;
  /** Functions requested by the connected device pins (more than one ⇒ conflict). */
  requestedFns: ControllerFunction[];
  /** Whether the controller pin supports the inferred function. */
  supported: boolean;
  bus: string | undefined;
  devices: { componentId: string; pin: string; type: PinType }[];
}

export interface I2cDevice {
  componentId: string;
  address: number | undefined;
  complete: boolean;
}

export interface I2cBus {
  id: string;
  sda: ControllerPinRef | undefined;
  scl: ControllerPinRef | undefined;
  devices: I2cDevice[];
}

export interface CanNetwork {
  id: string;
  netIds: string[];
  transceiverId: string | undefined;
  controllerTx: ControllerPinRef | undefined;
  controllerRx: ControllerPinRef | undefined;
  bitrate: number | undefined;
  nodes: { componentId: string; nodeId: number }[];
}

export interface UartLink {
  bus: string | undefined;
  componentId: string;
  controllerTx: ControllerPinRef | undefined;
  controllerRx: ControllerPinRef | undefined;
}

export interface PowerSink {
  componentId: string;
  pin: string;
  typicalMa: number;
  peakMa: number;
  range: { min: number; max: number } | undefined;
}

export interface PowerSource {
  componentId: string;
  pin: string;
  kind: "battery" | "regulator" | "board" | "other";
  voltage: number | undefined;
  maxVoltage: number | undefined;
  maxCurrentMa: number | undefined;
}

export interface PowerNet {
  netId: string;
  name: string;
  sources: PowerSource[];
  sinks: PowerSink[];
  voltage: number | undefined;
  maxVoltage: number | undefined;
  loadTypicalMa: number;
  loadPeakMa: number;
}

export type MotorBinding =
  | {
      kind: "hbridge";
      motorId: string;
      driverId: string;
      channel: string;
      in1: ControllerPinRef | undefined;
      in2: ControllerPinRef | undefined;
      pwm: ControllerPinRef | undefined;
      /** Enable pins and how they are driven. */
      enable: { pin: string; drive: ControllerPinRef | "tied_high" | undefined }[];
      reversedWiring: boolean;
      supplyNetId: string | undefined;
    }
  | { kind: "can"; motorId: string; driverId: string; nodeId: number; networkId: string | undefined }
  | { kind: "unbound"; motorId: string; reason: string };

export interface ServoBinding {
  servoId: string;
  signal: ControllerPinRef | undefined;
}

export interface SensorBinding {
  sensorId: string;
  kind: string;
  driver: string | undefined;
  iface: "i2c" | "gpio" | "analog" | "uart" | "none";
  i2c?: { bus: string; address: number | undefined };
  uart?: { bus: string | undefined };
  /** Device pin name → controller pin it is wired to. */
  pins: Record<string, ControllerPinRef | undefined>;
}

export interface HardwareIR {
  components: ResolvedComponent[];
  byId: Map<string, ResolvedComponent>;
  unresolved: ComponentInstance[];
  controller: ResolvedComponent | undefined;
  controllerCandidates: ResolvedComponent[];
  nets: Net[];
  netByPin: Map<string, Net>;
  pinAssignments: PinAssignment[];
  i2cBuses: I2cBus[];
  canNetworks: CanNetwork[];
  uartLinks: UartLink[];
  power: PowerNet[];
  motors: MotorBinding[];
  servos: ServoBinding[];
  sensors: SensorBinding[];
}

export interface RobotIR {
  spec: RobotSpec;
  catalog: Catalog;
  hardware: HardwareIR;
  behavior: import("./behavior/types").BehaviorIR;
  /** Diagnostics produced while building the IR (behavior compile errors etc.). */
  diagnostics: Diagnostic[];
}
