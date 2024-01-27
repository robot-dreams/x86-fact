import { useState } from "react";
import "./App.css";

const numInstructions = 18;
const numStackWords = 20;
const returnAddress = 0x1040;
const stackTop = 0xff98;

const offsets = [
  0x1000, 0x1004, 0x1009, 0x100f, 0x1015, 0x101e, 0x1023, 0x1028, 0x102d,
  0x1034, 0x1037, 0x103b, 0x1040, 0x1044, 0x1048, 0x104d, 0x1052, 0x1056,
];

const instructions = [
  "subq  $0x18, %rsp",
  "movq  %rdi, 0x8(%rsp)",
  "cmpq  $0x0, 0x8(%rsp)",
  "jne   0x1023",
  "movq  $0x1, 0x10(%rsp)",
  "jmp   0x104d",
  "movq  0x8(%rsp), %rax",
  "movq  0x8(%rsp), %rcx",
  "subq  $0x1, %rcx",
  "movq  %rcx, %rdi",
  "movq  %rax, (%rsp)",
  "callq  _factorial",
  "movq  (%rsp), %rcx",
  "imulq rax, %rcx",
  "movq  %rcx, 0x10(%rsp)",
  "movq  0x10(%rsp), %rax",
  "addq  $0x18, %rsp",
  "retq",
];

type Registers = {
  [reg: string]: number;
  // TODO: Add rflags
};

type Machine = {
  regs: Registers;
  stackWords: number[];
};

function newMachine(): Machine {
  return {
    regs: {
      rip: 0x1000,
      rsp: 0xff98,
      rdi: 0x04,
      rax: 0x00,
      rcx: 0x00,
    },
    stackWords: new Array(numStackWords).fill(0),
  };
}

function stackAddressToIndex(address: number) {
  return (stackTop - address) / 8 - 1;
}

function getStackWord(m: Machine, address: number) {
  const i = stackAddressToIndex(address);
  return m.stackWords[i];
}

function setStackWord(m: Machine, address: number, value: number) {
  const i = stackAddressToIndex(address);
  m.stackWords[i] = value;
}

function step(m: Machine) {
  switch (m.regs.rip) {
    case 0x1000:
      m.regs.rsp -= 0x18;
      m.regs.rip = 0x1004;
      break;

    case 0x1004:
      setStackWord(m, m.regs.rsp + 0x8, m.regs.rdi);
      m.regs.rip = 0x1009;
      break;

    case 0x1009:
      m.regs.rip = 0x100f;
      break;

    case 0x100f:
      if (getStackWord(m, m.regs.rsp + 0x8) != 0x0) {
        m.regs.rip = 0x1023;
      } else {
        m.regs.rip = 0x1015;
      }
      break;

    case 0x1015:
      setStackWord(m, m.regs.rsp + 0x10, 0x1);
      m.regs.rip = 0x101e;
      break;

    case 0x101e:
      m.regs.rip = 0x104d;
      break;

    case 0x1023:
      m.regs.rax = getStackWord(m, m.regs.rsp + 0x8);
      m.regs.rip = 0x1028;
      break;

    case 0x1028:
      m.regs.rcx = getStackWord(m, m.regs.rsp + 0x8);
      m.regs.rip = 0x102d;
      break;

    case 0x102d:
      m.regs.rcx -= 0x1;
      m.regs.rip = 0x1034;
      break;

    case 0x1034:
      m.regs.rdi = m.regs.rcx;
      m.regs.rip = 0x1037;
      break;

    case 0x1037:
      setStackWord(m, m.regs.rsp, m.regs.rax);
      m.regs.rip = 0x103b;
      break;

    case 0x103b:
      // Push return address to stack
      m.regs.rsp -= 0x8;
      setStackWord(m, m.regs.rsp, returnAddress);
      m.regs.rip = 0x1000;
      break;

    case 0x1040:
      m.regs.rcx = getStackWord(m, m.regs.rsp);
      m.regs.rip = 0x1044;
      break;

    case 0x1044:
      m.regs.rcx *= m.regs.rax;
      m.regs.rip = 0x1048;
      break;

    case 0x1048:
      setStackWord(m, m.regs.rsp + 0x10, m.regs.rcx);
      m.regs.rip = 0x104d;
      break;

    case 0x104d:
      m.regs.rax = getStackWord(m, m.regs.rsp + 0x10);
      m.regs.rip = 0x1052;
      break;

    case 0x1052:
      m.regs.rsp += 0x18;
      m.regs.rip = 0x1056;
      break;

    case 0x1056:
      m.regs.rip = getStackWord(m, m.regs.rsp);
      m.regs.rsp += 0x8;
      break;

    default:
      throw new Error(`unexpected %rip: ${m.regs.rip}`);
  }
  return m;
}

function StackRow({ machine, i }: { machine: Machine; i: number }) {
  const address = stackTop - 8 * i;
  const word =
    i === 0 ? "(caller)" : `0x${machine.stackWords[i - 1].toString(16)}`;
  const wordStyle =
    address < machine.regs.rsp
      ? { backgroundColor: "ghostwhite", color: "lightgray" }
      : {};
  return (
    <tr>
      <td className="label">{`0x${address.toString(16)}`}</td>
      <td style={wordStyle}>{word}</td>
      <td className="label">{address === machine.regs.rsp && "<- %rsp"}</td>
    </tr>
  );
}

function StackMemory({ machine }: { machine: Machine }) {
  const [reverse, setReverse] = useState(false);
  const stackRows = [];
  for (let i = 0; i < numStackWords; i++) {
    stackRows.push(<StackRow key={i} machine={machine} i={i} />);
  }
  if (reverse) {
    stackRows.reverse();
  }
  return (
    <table cellPadding={8} cellSpacing={0}>
      <thead>
        <tr>
          <th colSpan={3}>
            Stack Memory{" "}
            <button
              style={{ fontSize: 18, padding: 5 }}
              onClick={() => {
                setReverse(!reverse);
              }}
            >
              &#x21D5;
            </button>
          </th>
        </tr>
      </thead>
      <tbody>{stackRows}</tbody>
    </table>
  );
}

function Registers({ machine }: { machine: Machine }) {
  const registerRows = [];
  for (const reg of Object.keys(machine.regs)) {
    const value = machine.regs[reg];
    const display = `0x${value.toString(16)}`;
    registerRows.push(
      <tr key={reg}>
        <td className="label">{`%${reg}`}</td>
        <td>{display}</td>
      </tr>
    );
  }
  return (
    <table cellPadding={8} cellSpacing={0} width={"100%"}>
      <thead>
        <tr>
          <th colSpan={2}>Registers</th>
        </tr>
      </thead>
      <tbody>{registerRows}</tbody>
    </table>
  );
}

function InstructionRow({ machine, i }: { machine: Machine; i: number }) {
  const address = offsets[i];
  const isNext = address === machine.regs.rip;
  const instructionStyle = isNext
    ? { backgroundColor: "gray", color: "white" }
    : {};
  return (
    <tr>
      <td className="label">{`0x${address.toString(16)}`}</td>
      <td style={instructionStyle}>
        <pre style={{ display: "inline" }}>{instructions[i]}</pre>
      </td>
      <td className="label">{isNext && "<- %rip"}</td>
    </tr>
  );
}

function InstructionMemory({ machine }: { machine: Machine }) {
  const instructionRows = [];
  for (let i = 0; i < numInstructions; i++) {
    instructionRows.push(<InstructionRow key={i} machine={machine} i={i} />);
  }
  return (
    <table cellSpacing={0}>
      <thead>
        <tr>
          <th colSpan={3}>Instruction Memory</th>
        </tr>
      </thead>
      <tbody style={{ textAlign: "left" }}>
        <tr>
          <td></td>
          <td className="label">_factorial:</td>
          <td></td>
        </tr>
        {instructionRows}
      </tbody>
    </table>
  );
}

function App() {
  const [history, setHistory] = useState([newMachine()]);
  const machine = history[history.length - 1];

  function handleRewind() {
    setHistory(history.slice(0, history.length - 1));
  }

  function handleStep() {
    const m: Machine = {
      regs: { ...machine.regs },
      stackWords: [...machine.stackWords],
    };
    step(m);
    setHistory([...history, m]);
  }

  const done =
    machine.regs.rip === offsets[offsets.length - 1] &&
    machine.regs.rsp === stackTop;

  return (
    <table cellPadding={20}>
      <tbody>
        <tr>
          <td style={{ padding: 0, textAlign: "left" }}>
            <button disabled={history.length === 1} onClick={handleRewind}>
              Rewind
            </button>
          </td>
          <td style={{ padding: 0, textAlign: "right" }}>
            <button disabled={done} onClick={handleStep}>
              Step
            </button>
          </td>
        </tr>
        <tr>
          <td rowSpan={2}>
            <StackMemory machine={machine} />
          </td>
          <td style={{ verticalAlign: "top" }}>
            <Registers machine={machine} />
          </td>
        </tr>
        <tr>
          <td style={{ verticalAlign: "bottom" }}>
            <InstructionMemory machine={machine} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export default App;
