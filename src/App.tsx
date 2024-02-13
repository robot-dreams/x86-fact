import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import "./App.css";

const offsets = [
  0x1000, 0x1004, 0x1009, 0x100f, 0x1015, 0x101e, 0x1023, 0x1028, 0x102d,
  0x1034, 0x1037, 0x103b, 0x1040, 0x1044, 0x1048, 0x104d, 0x1052, 0x1056,
];

const numInstructions = 18;
const numStackWords = 20;
const returnAddress = 0x1040;
const stackTop = 0xff98;
const minAddress = offsets[0];

const regTitles: { [reg: string]: string } = {
  rip: "instruction pointer",
  rsp: "stack pointer",
  rdi: "1st argument",
  rax: "return value",
  rcx: "general purpose register",
  zf: "zero flag (part of %rflags)",
};

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

type Register = "rip" | "rsp" | "rdi" | "rax" | "rcx" | "zf";

type Registers = {
  [reg in Register]: number;
};

type Machine = {
  regs: Registers;
  stackWords: number[];
  changedReg: Register[];
  changedStack?: number;
};

const history: Machine[] = [
  {
    regs: {
      rip: 0x1000,
      rsp: 0xff98,
      rdi: 0x04,
      rax: 0x00,
      rcx: 0x00,
      zf: 0,
    },
    stackWords: new Array(numStackWords).fill(0),
    changedReg: [],
  },
];

function highlightChanged(style: React.CSSProperties) {
  style.fontWeight = "bold";
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
  m.changedStack = address;
}

function step(m: Machine) {
  m.changedReg = [];
  delete m.changedStack;

  switch (m.regs.rip) {
    case 0x1000:
      m.regs.rsp -= 0x18;
      m.regs.zf = m.regs.rsp === 0 ? 1 : 0;
      m.regs.rip = 0x1004;
      m.changedReg.push("rsp");
      m.changedReg.push("zf");
      break;

    case 0x1004:
      setStackWord(m, m.regs.rsp + 0x8, m.regs.rdi);
      m.regs.rip = 0x1009;
      break;

    case 0x1009:
      m.regs.rip = 0x100f;
      m.regs.zf = getStackWord(m, m.regs.rsp + 0x8) === 0 ? 1 : 0;
      break;

    case 0x100f:
      if (m.regs.zf === 0) {
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
      m.changedReg.push("rax");
      break;

    case 0x1028:
      m.regs.rcx = getStackWord(m, m.regs.rsp + 0x8);
      m.regs.rip = 0x102d;
      m.changedReg.push("rcx");
      break;

    case 0x102d:
      m.regs.rcx -= 0x1;
      m.regs.zf = m.regs.rcx === 0 ? 1 : 0;
      m.regs.rip = 0x1034;
      m.changedReg.push("rcx");
      break;

    case 0x1034:
      m.regs.rdi = m.regs.rcx;
      m.regs.rip = 0x1037;
      m.changedReg.push("rdi");
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
      m.changedReg.push("rsp");
      break;

    case 0x1040:
      m.regs.rcx = getStackWord(m, m.regs.rsp);
      m.regs.rip = 0x1044;
      m.changedReg.push("rcx");
      break;

    case 0x1044:
      m.regs.rcx *= m.regs.rax;
      m.regs.rip = 0x1048;
      m.changedReg.push("rcx");
      break;

    case 0x1048:
      setStackWord(m, m.regs.rsp + 0x10, m.regs.rcx);
      m.regs.rip = 0x104d;
      break;

    case 0x104d:
      m.regs.rax = getStackWord(m, m.regs.rsp + 0x10);
      m.regs.rip = 0x1052;
      m.changedReg.push("rax");
      break;

    case 0x1052:
      m.regs.rsp += 0x18;
      m.regs.zf = m.regs.rsp === 0 ? 1 : 0;
      m.regs.rip = 0x1056;
      m.changedReg.push("rsp");
      m.changedReg.push("zf");
      break;

    case 0x1056:
      m.regs.rip = getStackWord(m, m.regs.rsp);
      m.regs.rsp += 0x8;
      m.changedReg.push("rsp");
      break;

    default:
      throw new Error(`unexpected %rip: ${m.regs.rip}`);
  }
  return m;
}

function ensureHistory() {
  for (;;) {
    const prev = history[history.length - 1];
    const done =
      prev.regs.rip === offsets[offsets.length - 1] &&
      prev.regs.rsp === stackTop;
    if (done) {
      return;
    }
    const m: Machine = {
      regs: { ...prev.regs },
      stackWords: [...prev.stackWords],
      changedReg: [],
    };
    step(m);
    history.push(m);
  }
}

const StackMemory = forwardRef(function (
  { machine }: { machine: Machine },
  ref: React.ForwardedRef<HTMLTableDataCellElement>
) {
  const [reverse, setReverse] = useState(false);
  const stackRows = [];
  for (let i = 0; i < numStackWords; i++) {
    const address = stackTop - 8 * i;
    const word = machine.stackWords[i - 1];
    const display =
      i === 0
        ? "(return address)"
        : word >= minAddress
        ? `0x${word.toString(16)}`
        : word.toString();
    const wordStyle: React.CSSProperties = {};
    if (address < machine.regs.rsp) {
      wordStyle.backgroundColor = "ghostwhite";
      wordStyle.color = "lightgray";
    }
    if (address === machine.changedStack) {
      highlightChanged(wordStyle);
    }
    if (address === machine.regs.rsp) {
      wordStyle.outline = "1px solid gray";
      stackRows.push(
        <tr key={i}>
          <td className="label">{`0x${address.toString(16)}`}</td>
          <td style={wordStyle} ref={ref}>
            {display}
          </td>
        </tr>
      );
    } else {
      stackRows.push(
        <tr key={i}>
          <td className="label">{`0x${address.toString(16)}`}</td>
          <td style={wordStyle}>{display}</td>
        </tr>
      );
    }
  }
  if (reverse) {
    stackRows.reverse();
  }
  return (
    <table cellPadding={8} cellSpacing={0}>
      <thead>
        <tr>
          <th colSpan={2}>
            Stack Memory{" "}
            <button
              style={{ padding: 0 }}
              onClick={() => {
                setReverse(!reverse);
              }}
            >
              &nbsp;&#x21D5;&nbsp;
            </button>
          </th>
        </tr>
      </thead>
      <tbody>{stackRows}</tbody>
    </table>
  );
});

const RegisterTable = forwardRef(function (
  { machine }: { machine: Machine },
  ref: React.ForwardedRef<HTMLTableDataCellElement>
) {
  const registerRows = [];
  for (const key of Object.keys(machine.regs)) {
    const reg = key as Register;
    const label = reg === "zf" ? "zf" : "%" + reg;
    const wordStyle: React.CSSProperties = {};
    if (machine.changedReg.indexOf(reg) !== -1) {
      highlightChanged(wordStyle);
    }
    const value = machine.regs[reg];
    const display =
      value >= minAddress ? `0x${value.toString(16)}` : value.toString();
    if (reg === "rsp") {
      registerRows.push(
        <tr key={reg}>
          <td
            title={regTitles[reg]}
            className="label"
            ref={ref}
            style={{ outline: "1px solid gray" }}
          >
            {label}
          </td>
          <td style={wordStyle}>{display}</td>
        </tr>
      );
    } else {
      registerRows.push(
        <tr key={reg}>
          <td title={regTitles[reg]} className="label">
            {label}
          </td>
          <td style={wordStyle}>{display}</td>
        </tr>
      );
    }
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
});

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
          <th colSpan={2}>Instruction Memory</th>
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
  const [index, setIndex] = useState(0);
  const line1Ref: React.MutableRefObject<HTMLDivElement | null> = useRef(null);
  const line2Ref: React.MutableRefObject<HTMLDivElement | null> = useRef(null);
  const line3Ref: React.MutableRefObject<HTMLDivElement | null> = useRef(null);
  const rspRef: React.MutableRefObject<HTMLTableDataCellElement | null> =
    useRef(null);
  const stackTopRef: React.MutableRefObject<HTMLTableDataCellElement | null> =
    useRef(null);

  ensureHistory();
  const machine = history[index];
  const done =
    machine.regs.rip === offsets[offsets.length - 1] &&
    machine.regs.rsp === stackTop;

  useLayoutEffect(() => {
    function recalculate() {
      if (
        line1Ref.current !== null &&
        line2Ref.current !== null &&
        line3Ref.current !== null &&
        rspRef.current !== null &&
        stackTopRef.current !== null
      ) {
        const line1 = line1Ref.current;
        const line2 = line2Ref.current;
        const line3 = line3Ref.current;
        const rspRect = rspRef.current.getBoundingClientRect();
        const stackTopRect = stackTopRef.current.getBoundingClientRect();

        const x0 = rspRect.left;
        const y0 = rspRect.top + rspRect.height / 2;

        const x3 = stackTopRect.left + stackTopRect.width;
        const y3 = stackTopRect.top + stackTopRect.height / 2;

        const x1 = (x0 + x3) / 2;
        const y1 = y0;

        const x2 = x1;
        const y2 = y3;

        line1.style.width = Math.abs(x1 - x0) + "px";
        line1.style.height = "1px";
        line1.style.left = x1 + "px";
        line1.style.top = y1 + "px";

        line2.style.width = "1px";
        line2.style.height = Math.abs(y2 - y1) + "px";
        line2.style.left = x2 + "px";
        line2.style.top = Math.min(y1, y2) + "px";

        line3.style.width = 1 + Math.abs(x3 - x2) + "px";
        line3.style.height = "1px";
        line3.style.left = x3 + "px";
        line3.style.top = y3 + "px";
      }
    }
    recalculate();
    window.addEventListener("resize", recalculate);
    return () => {
      window.removeEventListener("resize", recalculate);
    };
  });

  return (
    <>
      <table cellPadding={20}>
        <tbody>
          <tr>
            <td style={{ padding: 0, textAlign: "left" }}>
              <button
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                Rewind
              </button>
            </td>
            <td style={{ padding: 0, textAlign: "right" }}>
              <button disabled={done} onClick={() => setIndex(index + 1)}>
                Step
              </button>
            </td>
          </tr>
          <tr>
            <td colSpan={2} id="slider">
              <input
                type="range"
                min={0}
                max={history.length - 1}
                value={index}
                onInput={(e) => {
                  const newIndex = Number.parseInt(e.currentTarget.value);
                  setIndex(newIndex);
                }}
                style={{ width: "100%" }}
              />
            </td>
          </tr>
          <tr>
            <td rowSpan={2}>
              <StackMemory machine={machine} ref={stackTopRef} />
            </td>
            <td style={{ verticalAlign: "top" }}>
              <RegisterTable machine={machine} ref={rspRef} />
            </td>
          </tr>
          <tr>
            <td style={{ verticalAlign: "bottom" }}>
              <InstructionMemory machine={machine} />
            </td>
          </tr>
        </tbody>
      </table>
      <div className="line" ref={line1Ref}></div>
      <div className="line" ref={line2Ref}></div>
      <div className="line" ref={line3Ref}></div>
    </>
  );
}

export default App;
