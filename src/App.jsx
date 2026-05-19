import { useState, useEffect } from "react";
import Auth from "./Auth";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { signOut } from "firebase/auth";
import {
  saveShared,
  loadShared,
  subscribeShared,
  ensureGroupExists
} from "./firestore";
// ─── Storage ──────────────────────────────────────────────────────────────────
// shared=true  → visible to all group members (plans, water, expenses, member list)
// shared=false → private to this browser/device session (tasks per member)

async function load(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function save(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

// Shared keys
const SKEY = { members: "mt:members", water: "mt:water", expenses: "mt:expenses", plans: "mt:plans" };
// Private key (per member)
const taskKey = (memberId) => `mt:tasks:${memberId}`;

// ─── Utility ──────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().split("T")[0]; };
const addWeeks = (d, n) => addDays(d, n * 7);
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x.toISOString().split("T")[0]; };
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
const isOverdue = (d) => d && d < today();
const uid = () => Math.random().toString(36).slice(2, 9);

const COLORS = ["#7F77DD","#1D9E75","#D85A30","#D4537E","#378ADD","#639922","#BA7517","#E24B4A","#534AB7","#0F6E56"];
const avatarColor = (i) => COLORS[i % COLORS.length];

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {

  const [user, setUser] = useState(null);
  const [stage, setStage]       = useState("loading"); // loading | setup | pick | app
  const [members, setMembers]   = useState([]);
  const [currentMember, setCurrent] = useState(null);
  const [tab, setTab]           = useState("tasks");
  const [groupId, setGroupId] =
  useState(
    localStorage.getItem("groupId") || ""
  );
  const [tempGroup, setTempGroup] =
  useState("");
  const [showInvite, setShowInvite] =
  useState(false);
  const [showSettings, setShowSettings] =
  useState(false);

  useEffect(() => {
  (async () => {

    if (!user || !groupId) return;

    const shared =
      await loadShared(groupId);

    const m =
      shared?.members || [];

    const existing =
      m.find(member =>
        member.email === user?.email
      );

    if (existing) {

      setCurrent(existing);

    } else {

      const newMember = {
        id: user.uid,
        name: user.email.split("@")[0],
        email: user.email
      };

      const updatedMembers =
        [...m, newMember];

      await saveShared(
        groupId,
        "members",
        updatedMembers
      );

      setMembers(updatedMembers);

      setCurrent(newMember);

    }

    setStage("app");

  })();
}, [user, groupId]);

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(auth, (currentUser) => {

        setUser(currentUser);

      });

    return () => unsubscribe();

  }, []);

  useEffect(() => {

  if (!groupId) return;

  const unsubscribe =
    subscribeShared(
      groupId,
      (data) => {

        if (data?.members) {

          setMembers(
            data.members
          );

        }

      }
    );

  return () => unsubscribe();

  }, [groupId]);

  const onSetupDone = async (m) => {
    await save(SKEY.members, m, true);
    setMembers(m);
    setStage("pick");
  };

  const onPick = async (m) => {
    await save("mt:whoami", m.id, false);
    setCurrent(m);
    setStage("app");
  };

  const switchMember = () => {};

  const resetAll = async () => {
    if (!confirm("Reset everything? This deletes all group data.")) return;
    await save(SKEY.members, [], true);
    await save("mt:whoami", null, false);
    setMembers([]); setCurrent(null); setStage("setup");
  };  

  const leaveGroup = () => {

  if (
    !confirm(
      "Leave current group?"
    )
  ) return;

  localStorage.removeItem(
    "groupId"
  );

  setGroupId("");

  setMembers([]);

  setCurrent(null);

  };

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

if (!groupId || showInvite) {
  return (

    <div style={{
      padding: 30,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }}>

      <h2>Join Group</h2>
      <button
      style={{
        marginBottom: 16
      }}

      onClick={async () => {

        const newGroupId =
           crypto.randomUUID()
            .slice(0, 6)
            .toUpperCase();

        await ensureGroupExists(
          newGroupId
        );

        localStorage.setItem(
          "groupId",
          newGroupId
        );
        
        setShowInvite(true);


      }}
    >
      Create Group
    </button>

      <input
        placeholder="Enter Group Code"
        value={tempGroup}
        onChange={(e) =>
          setTempGroup(e.target.value)
        }
      />

      <button
        type="button"
      onClick={async () => {

        if (!tempGroup.trim()) return;

        const cleaned =
          tempGroup.trim().toUpperCase();

        await ensureGroupExists(cleaned);

        localStorage.setItem(
          "groupId",
          cleaned
        );

      setGroupId(cleaned);
      
      }}
      >
        Join Group
      </button>

      {showInvite && (

  <div style={{
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    background: "#f3f3f3"
  }}>

    <p style={{
      fontWeight: 600,
      marginBottom: 8
    }}>
      Invite Code
    </p>

    <h2 style={{
      letterSpacing: 2,
      marginBottom: 16
    }}>
      {localStorage.getItem("groupId")}
    </h2>

    <div style={{
      display: "flex",
      gap: 10
    }}>

      <button
        onClick={() => {

          navigator.clipboard.writeText(
            localStorage.getItem("groupId")
          );

          alert("Code copied!");

        }}
      >
        Copy Code
      </button>

      <button
        onClick={async () => {

          const code =
            localStorage.getItem("groupId");

          if (navigator.share) {

            await navigator.share({

              title: "Join My MemTask Group",

              text:
                `Join my MemTask group using code: ${code}`

            });

          } else {

            alert(
              "Sharing not supported on this device"
            );

          }

        }}
      >
        Share
      </button>

    </div>

    <button

      style={{
        marginTop: 16,
        width: "100%"
      }}

      onClick={() => {

        setShowInvite(false);

        setGroupId(
          localStorage.getItem("groupId")
        );

      }}

    >
      Continue
    </button>

  </div>

)}

    </div>

  );
}

  if (stage === "loading") return (
    <div style={styles.center}>
      <div style={styles.spinner} />
      <p style={{ color: "var(--color-text-secondary)", marginTop: 12, fontSize: 14 }}>Loading…</p>
    </div>
  );


  const TABS = [
    { id: "tasks",    icon: "ti-checkbox",      label: "Tasks" },
    { id: "plans",    icon: "ti-calendar-week", label: "Plans" },
    { id: "water",    icon: "ti-droplet",        label: "Water" },
    { id: "expenses", icon: "ti-receipt",        label: "Split" },
  ];

  const mi = members.findIndex(m => m.id === currentMember?.id);

  return (
    <>
    <div style={styles.shell}>
      <div style={styles.topBar}>
        <span style={styles.appName}>MemTask</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={styles.memberPill}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: avatarColor(mi), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>
              {currentMember?.name?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{currentMember?.name}</span>
            <i className="ti ti-chevron-down" style={{ fontSize: 12, opacity: 0.6 }} />
          </button>

          <button

            style={styles.iconBtn}

            onClick={() =>
              setShowSettings(true)
            }

            title="Group Settings"
          >

            <i
              className="ti ti-settings"
              style={{ fontSize: 17 }}
            />

          </button>

        </div>
      </div>
      <div style={styles.content}>
        {tab === "tasks"    && <Tasks    memberId={currentMember?.id} members={members} />}

        {tab === "plans" && (
          <Plans
            members={members}
            groupId={groupId}
          />
        )}

        {tab === "water" && (
          <Water
            members={members}
            currentMemberId={currentMember?.id}
            groupId={groupId}
          />
        )}
        
        {tab === "expenses" && (
          <Expenses
            members={members}
            currentMemberId={currentMember?.id}
            groupId={groupId}
          />
        )}
      </div>
      <nav style={styles.nav}>
        {TABS.map(t => (
          <button key={t.id} style={{ ...styles.navBtn, ...(tab === t.id ? styles.navBtnActive : {}) }} onClick={() => setTab(t.id)}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 22 }} />
            <span style={{ fontSize: 10, marginTop: 2 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>

    {showSettings && (

    <Modal
      title="Group Settings"
      onClose={() =>
        setShowSettings(false)
      }
    >

      <div style={styles.card}>

        <p style={{
          margin: 0,
          fontSize: 12,
          opacity: 0.7
        }}>
          GROUP CODE
        </p>

        <h2 style={{
          margin: "6px 0 0",
          letterSpacing: 2
        }}>
          {groupId}
        </h2>

      </div>
      
      <p style={styles.sectionLabel}>
        Members :
      </p>
      <p>Members:</p>

        {members.map((m,i) => (

      <div
        key={m.id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10
        }}
      >

        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: avatarColor(i),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700
        }}>

        {m?.name?.[0]?.toUpperCase() || "?"}
        
        </div>

        <span>
          {m.name}
        </span>

      </div>
        ))}

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 16
        }}>

        <button

          onClick={() => {

            navigator.clipboard.writeText(
              groupId
            );

            alert("Code copied!");

          }}


          style={{
            ...styles.primaryBtn,
            width: "100%",
            background: "#7F77DD"
          }}

        >

          Copy Invite Code

        </button>


        <button

            onClick={async () => {

              if (navigator.share) {

                await navigator.share({

                  title: "Join My MemTask Group",

                  text:
                    `Join my group using code: ${groupId}`

                });

              }

            }}


            style={{
              ...styles.primaryBtn,
              width: "100%",
              background: "#378ADD"
            }}

          >

          Share Invite

        </button>

        <button onClick={leaveGroup}
                
          style={{
            ...styles.primaryBtn,
            width: "100%",
            background: "#D85A30"
          }}
        
        >

          Leave Group

        </button>


        <button

          onClick={async () => {

            localStorage.removeItem(
              "groupId"
            );

            await signOut(auth);

          }}


          style={{
            ...styles.primaryBtn,
            width: "100%",
            background: "#E24B4A"
          }}

        >

          Logout

        </button>
        
      </div>

    </Modal>

  )}
  </>
  );
}

// ─── Setup: count → names ─────────────────────────────────────────────────────
function Setup({ onDone }) {
  const [step, setStep]   = useState("count"); // count | names
  const [count, setCount] = useState("");
  const [names, setNames] = useState([]);

  const goNames = () => {
    const n = parseInt(count);
    if (!n || n < 1 || n > 50) return;
    setNames(Array.from({ length: n }, () => ""));
    setStep("names");
  };

  const upd = (i, v) => { const a = [...names]; a[i] = v; setNames(a); };

  const submit = () => {
    const valid = names.map(n => n.trim());
    if (valid.some(n => !n)) return;
    onDone(valid.map(name => ({ id: uid(), name })));
  };

  return (
    <div style={{ padding: "2.5rem 1.25rem" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>
          <span style={{ fontWeight: 800, letterSpacing: -1, color: "var(--color-text-primary)" }}>Mem</span>
          <span style={{ fontWeight: 800, letterSpacing: -1, color: "#7F77DD" }}>Task</span>
        </div>
        <p style={{ color: "var(--color-text-secondary)", margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          {step === "count" ? "How many people are in your group?" : `Enter each member's name.`}
        </p>
      </div>

      {step === "count" && (
        <>
          <label style={styles.label}>Number of members</label>
          <input type="number" style={styles.input} value={count} min={1} max={50}
            onChange={e => setCount(e.target.value)} placeholder="e.g. 5"
            onKeyDown={e => e.key === "Enter" && goNames()} autoFocus />
          <button style={{ ...styles.primaryBtn, width: "100%", marginTop: 4 }} onClick={goNames}>Next →</button>
        </>
      )}

      {step === "names" && (
        <>
          <label style={styles.label}>Member names</label>
          {names.map((n, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarColor(i), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                {i + 1}
              </div>
              <input value={n} onChange={e => upd(i, e.target.value)} placeholder={`Member ${i+1}`}
                style={{ ...styles.input, flex: 1, marginBottom: 0 }}
                onKeyDown={e => e.key === "Enter" && i === names.length - 1 && submit()} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button style={{ ...styles.outlineBtn, flex: 1 }} onClick={() => setStep("count")}>← Back</button>
            <button style={{ ...styles.primaryBtn, flex: 2 }} onClick={submit}>Create group →</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Pick Member ──────────────────────────────────────────────────────────────
function PickMember({ members, onPick }) {
  return (
    <div style={{ padding: "2rem 1.25rem" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>
          <span style={{ fontWeight: 800, letterSpacing: -1 }}>Mem</span>
          <span style={{ fontWeight: 800, letterSpacing: -1, color: "#7F77DD" }}>Task</span>
        </div>
        <p style={{ color: "var(--color-text-secondary)", margin: 0, fontSize: 14 }}>Who are you? Your tasks will be private to you.</p>
      </div>
      {members.map((m, i) => (
        <button key={m.id} style={styles.memberPickBtn} onClick={() => onPick(m)}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: avatarColor(i), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff" }}>
            {m.name[0].toUpperCase()}
          </div>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{m.name}</span>
          <i className="ti ti-chevron-right" style={{ fontSize: 16, marginLeft: "auto", opacity: 0.4 }} />
        </button>
      ))}
    </div>
  );
}

// ─── Tasks (PRIVATE per member) ───────────────────────────────────────────────
function Tasks({ memberId, members }) {
  const [tasks, setTasks] = useState([]);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    load(taskKey(memberId), false).then(d => { setTasks(d || []); setLoaded(true); });
  }, [memberId]);

  const persist = (t) => { setTasks(t); save(taskKey(memberId), t, false); };
  const addTask = (t) => persist([...tasks, { ...t, id: uid(), done: false, createdAt: today(), extended: 0 }]);
  const toggle  = (id) => persist(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const extend  = (id, mode) => persist(tasks.map(t => {
    if (t.id !== id) return t;
    const nd = mode === "week" ? addWeeks(t.deadline || today(), 1) : addMonths(t.deadline || today(), 1);
    return { ...t, deadline: nd, extended: (t.extended || 0) + 1 };
  }));
  const del = (id) => persist(tasks.filter(t => t.id !== id));
  const editTask = (id, upd) => persist(tasks.map(t => t.id === id ? { ...t, ...upd } : t));

  const visible = tasks.filter(t => {
    if (filter === "active")  return !t.done;
    if (filter === "done")    return t.done;
    if (filter === "overdue") return !t.done && isOverdue(t.deadline);
    return true;
  });
  const overdue = tasks.filter(t => !t.done && isOverdue(t.deadline)).length;

  if (!loaded) return <div style={styles.center}><div style={styles.spinner} /></div>;

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>My Tasks</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>
            <i className="ti ti-lock" style={{ fontSize: 11, marginRight: 3 }} />Private to you
            {overdue > 0 && <span style={{ ...styles.badgeDanger, marginLeft: 8 }}>{overdue} overdue</span>}
          </p>
        </div>
        <button style={styles.primaryBtn} onClick={() => setModal("add")}>
          <i className="ti ti-plus" style={{ marginRight: 4 }} /> Add
        </button>
      </div>
      <div style={styles.filterRow}>
        {["all","active","done","overdue"].map(f => (
          <button key={f} style={{ ...styles.chip, ...(filter === f ? styles.chipActive : {}) }} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {visible.length === 0 && <Empty icon="ti-checkbox" text="No tasks here" />}
      {visible.map(t => (
        <TaskCard key={t.id} task={t}
          onToggle={() => toggle(t.id)}
          onExtend={(m) => extend(t.id, m)}
          onDelete={() => del(t.id)}
          onEdit={() => setModal(t)} />
      ))}
      {modal && (
        <TaskModal task={modal === "add" ? null : modal}
          onSave={(t) => { if (modal === "add") addTask(t); else editTask(modal.id, t); setModal(null); }}
          onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function TaskCard({ task, onToggle, onExtend, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const over = !task.done && isOverdue(task.deadline);
  return (
    <div style={{ ...styles.card, opacity: task.done ? 0.55 : 1, borderLeft: over ? "3px solid #E24B4A" : "3px solid transparent" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button style={{ ...styles.checkbox, ...(task.done ? styles.checkboxDone : {}) }} onClick={onToggle}>
          {task.done && <i className="ti ti-check" style={{ fontSize: 13 }} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 500, fontSize: 15, textDecoration: task.done ? "line-through" : "none", wordBreak: "break-word" }}>{task.title}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
            {task.deadline && (
              <span style={over ? styles.badgeDanger : styles.badgeNeutral}>
                <i className="ti ti-calendar" style={{ fontSize: 11, marginRight: 3 }} />{fmtDate(task.deadline)}
                {task.extended > 0 && ` +${task.extended}x`}
              </span>
            )}
            {task.priority && <span style={{ ...styles.badgeNeutral, background: task.priority==="high" ? "#FCEBEB" : task.priority==="medium" ? "#FAEEDA" : "var(--color-background-secondary)", color: task.priority==="high" ? "#A32D2D" : task.priority==="medium" ? "#633806" : "var(--color-text-secondary)" }}>{task.priority}</span>}
          </div>
        </div>
        <button style={styles.iconBtn} onClick={() => setExpanded(!expanded)}>
          <i className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 15 }} />
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
          {task.notes && <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>{task.notes}</p>}
          {over && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button style={styles.outlineBtn} onClick={() => onExtend("week")}>+1 Week</button>
              <button style={styles.outlineBtn} onClick={() => onExtend("month")}>+1 Month</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.outlineBtn} onClick={onEdit}><i className="ti ti-edit" style={{ marginRight: 4 }} />Edit</button>
            <button style={{ ...styles.outlineBtn, color: "#E24B4A" }} onClick={onDelete}><i className="ti ti-trash" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskModal({ task, onSave, onClose }) {
  const [title,    setTitle]    = useState(task?.title    || "");
  const [deadline, setDeadline] = useState(task?.deadline || "");
  const [priority, setPriority] = useState(task?.priority || "medium");
  const [notes,    setNotes]    = useState(task?.notes    || "");
  const submit = () => { if (!title.trim()) return; onSave({ title: title.trim(), deadline, priority, notes }); };
  return (
    <Modal title={task ? "Edit task" : "New task"} onClose={onClose}>
      <label style={styles.label}>Title *</label>
      <input style={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus />
      <label style={styles.label}>Deadline</label>
      <input type="date" style={styles.input} value={deadline} onChange={e => setDeadline(e.target.value)} />
      <label style={styles.label}>Priority</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["low","medium","high"].map(p => (
          <button key={p} style={{ ...styles.chip, ...(priority === p ? styles.chipActive : {}), flex: 1, justifyContent: "center" }} onClick={() => setPriority(p)}>{p}</button>
        ))}
      </div>
      <label style={styles.label}>Notes</label>
      <textarea style={{ ...styles.input, height: 68, resize: "none" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional…" />
      <button style={{ ...styles.primaryBtn, width: "100%", marginTop: 4 }} onClick={submit}>Save task</button>
    </Modal>
  );
}

// ─── Plans (SHARED) ───────────────────────────────────────────────────────────
function Plans({ members , groupId }) {
  const [plans, setPlans] = useState({ weekly: [], monthly: [] });
  const [mode, setMode]   = useState("weekly");
  const [modal, setModal] = useState(false);
  useEffect(() => {

  if (!groupId) return;

  const unsubscribe =
    subscribeShared(
      groupId,
      (data) => {

      setPlans(
        data?.plans || {
          weekly: [],
          monthly: []
        }
      );

      }
    );

  return () => unsubscribe();

}, [groupId]);

const persist = async (p) => {

  setPlans(p);

  await saveShared(
    groupId,
    "plans",
    p
  );

};

const addItem = async (title) => {

  if (!title.trim()) return;

  const updated = {

    ...plans,

    [mode]: [
      ...(plans?.[mode] || []),
      {
        id: uid(),
        title,
        done: false,
        rolledOver: 0
      }
    ]

  };

  await persist(updated);

};

  const toggle  = (id) => persist({ ...plans, [mode]: plans[mode].map(p => p.id === id ? { ...p, done: !p.done } : p) });
  const del     = (id) => persist({ ...plans, [mode]: plans[mode].filter(p => p.id !== id) });
  const rollover = () => {
    const incomplete = plans[mode].filter(p => !p.done).map(p => ({ ...p, done: false, rolledOver: (p.rolledOver || 0) + 1 }));
    persist({ ...plans, [mode]: incomplete });
    alert(`${incomplete.length} item(s) carried over.`);
  };

  const items = plans?.[mode] || [];
  const done  = items.filter(p => p.done).length;

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Plans</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>
            <i className="ti ti-users" style={{ fontSize: 11, marginRight: 3 }} />Shared with group
          </p>
        </div>
        <button style={styles.primaryBtn} onClick={() => setModal(true)}>
          <i className="ti ti-plus" style={{ marginRight: 4 }} /> Add
        </button>
      </div>
      <div style={styles.filterRow}>
        <button style={{ ...styles.chip, ...(mode === "weekly"  ? styles.chipActive : {}) }} onClick={() => setMode("weekly")}>Weekly</button>
        <button style={{ ...styles.chip, ...(mode === "monthly" ? styles.chipActive : {}) }} onClick={() => setMode("monthly")}>Monthly</button>
      </div>
      {items.length > 0 && (
        <div style={{ ...styles.card, marginBottom: 12, padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{done}/{items.length} complete</span>
            <button style={{ ...styles.outlineBtn, padding: "4px 10px", fontSize: 12 }} onClick={rollover}>Rollover →</button>
          </div>
          <div style={{ marginTop: 8, height: 4, background: "var(--color-background-secondary)", borderRadius: 4 }}>
            <div style={{ height: "100%", width: `${items.length ? (done/items.length)*100 : 0}%`, background: "#1D9E75", borderRadius: 4, transition: "width 0.3s" }} />
          </div>
        </div>
      )}
      {items.length === 0 && <Empty icon="ti-calendar-week" text={`No ${mode} plans yet`} />}
      {items.map(p => (
        <div key={p.id} style={{ ...styles.card, opacity: p.done ? 0.55 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button style={{ ...styles.checkbox, ...(p.done ? styles.checkboxDone : {}) }} onClick={() => toggle(p.id)}>
              {p.done && <i className="ti ti-check" style={{ fontSize: 13 }} />}
            </button>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 500, textDecoration: p.done ? "line-through" : "none" }}>{p.title}</p>
              {p.rolledOver > 0 && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Rolled over {p.rolledOver}×</span>}
            </div>
            <button style={styles.iconBtn} onClick={() => del(p.id)}><i className="ti ti-trash" style={{ fontSize: 15 }} /></button>
          </div>
        </div>
      ))}
      {modal && (
        <Modal title={`New ${mode} item`} onClose={() => setModal(false)}>
          <label style={styles.label}>Item *</label>
          <QuickInput placeholder="e.g. Buy groceries" onSave={(t) => { addItem(t); setModal(false); }} />
        </Modal>
      )}
    </div>
  );
}

// ─── Water Turns (SHARED) ─────────────────────────────────────────────────────
function Water({ members, currentMemberId, groupId }) {
  const [state, setState] = useState(null);
  const [ready, setReady] = useState(false);

useEffect(() => {

  if (!groupId) return;

  const unsubscribe =
    subscribeShared(
      groupId,
      async (data) => {

        if (data?.water) {

          setState(data.water);

        } else {

          const init = {
            currentIndex: 0,
            history: [],
            cycle: members.map(
              m => m.id
            )
          };

          setState(init);

          await saveShared(
            groupId,
            "water",
            init
          );

        }

        setReady(true);

      }
    );

  return () => unsubscribe();

}, [groupId]);

const persist = async (s) => {

  setState(s);

  await saveShared(
    groupId,
    "water",
    s
  );

};

  const markDone = () => {
    if (!state) return;
    const current = state?.cycle?.[state.currentIndex];
    const nextIndex = (state.currentIndex + 1) % state.cycle.length;
    const entry = { memberId: current, date: today(), time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) };
    persist({ ...state, currentIndex: nextIndex, history: [entry, ...state.history.slice(0, 39)] });
  };

  const skip   = () => persist({ ...state, currentIndex: (state.currentIndex + 1) % state.cycle.length });
  const reset  = () => { if(confirm("Reset water turns?")) persist({ currentIndex: 0, history: [], cycle: members.map(m => m.id) }); };

  if (!ready) return <div style={styles.center}><div style={styles.spinner} /></div>;
  if (!state || members.length === 0) return <Empty icon="ti-droplet" text="No members found" />;

  const currentId     = state?.cycle?.[state.currentIndex];
  const currentMember = members.find(m => m.id === currentId);
  const nextId        = state?.cycle?.[(state.currentIndex + 1) % state.cycle.length];
  const nextMember    = members.find(m => m.id === nextId);
  const mi            = members.findIndex(m => m.id === currentId);
  const isMyTurn      = currentId === currentMemberId;

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Water Turns</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>
            <i className="ti ti-users" style={{ fontSize: 11, marginRight: 3 }} />{members.length} members
          </p>
        </div>
        <button style={styles.outlineBtn} onClick={reset}><i className="ti ti-refresh" style={{ marginRight: 4 }} />Reset</button>
      </div>

      <div style={{ ...styles.card, textAlign: "center", padding: "24px 20px 20px", marginBottom: 12, ...(isMyTurn ? { border: "2px solid #7F77DD" } : {}) }}>
        {isMyTurn && <span style={{ ...styles.badgeInfo, marginBottom: 10, display: "inline-flex" }}>Your turn!</span>}
        <div style={{ width: 68, height: 68, borderRadius: "50%", background: avatarColor(mi), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "#fff", margin: "0 auto 10px" }}>
          {currentMember?.name?.[0]?.toUpperCase()}
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 2px" }}>Current turn</p>
        <h3 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 18px" }}>{currentMember?.name}</h3>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...styles.primaryBtn, flex: 1 }} onClick={markDone}><i className="ti ti-check" style={{ marginRight: 6 }} />Done</button>
          <button style={{ ...styles.outlineBtn, flex: 1, justifyContent: "center" }} onClick={skip}>Skip</button>
        </div>
      </div>

      {nextMember && (
        <div style={{ ...styles.card, display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: avatarColor(members.findIndex(m => m.id === nextId)), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>
            {nextMember.name[0].toUpperCase()}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>Up next</p>
            <p style={{ margin: 0, fontWeight: 500 }}>{nextMember.name}</p>
          </div>
        </div>
      )}

      <p style={styles.sectionLabel}>{members.length} members · full sequence</p>
      <div style={{ ...styles.card, padding: 0, overflow: "hidden", marginBottom: 16 }}>
        {state?.cycle?.map((id, i) => {
          const m = members.find(x => x.id === id);
          const isCur = i === state.currentIndex;
          const ci = members.findIndex(x => x.id === id);
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: isCur ? "#EEEDFEaa" : undefined, borderBottom: i < (state?.cycle?.length || 0)-1 ? "0.5px solid var(--color-border-tertiary)" : undefined }}>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", width: 22, textAlign: "right" }}>#{i+1}</span>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: avatarColor(ci), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                {m?.name?.[0]?.toUpperCase()}
              </div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: isCur ? 600 : 400 }}>{m?.name}</span>
              {isCur && <span style={styles.badgeInfo}>Now</span>}
              {id === currentMemberId && !isCur && <span style={{ fontSize: 11, color: "#7F77DD" }}>You</span>}
            </div>
          );
        })}
      </div>

      {state?.history?.length > 0 && (
        <>
          <p style={styles.sectionLabel}>Recent history</p>
          <div style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
            {state?.history?.slice(0, 10).map((h, i) => {
              const m = members.find(x => x.id === h.memberId);
              const ci = members.findIndex(x => x.id === h.memberId);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: i < 9 ? "0.5px solid var(--color-border-tertiary)" : undefined }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: avatarColor(ci), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>
                    {m?.name?.[0]?.toUpperCase()}
                  </div>
                  <span style={{ flex: 1, fontSize: 13 }}>{m?.name}</span>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{h.date === today() ? `Today ${h.time}` : fmtDate(h.date)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Expenses (SHARED) ────────────────────────────────────────────────────────
function Expenses({ members, currentMemberId , groupId}) {
  const [expenses, setExpenses] = useState([]);
  const [modal, setModal]       = useState(false);
  const [view, setView]         = useState("balances");

  useEffect(() => {

    if (!groupId) return;

    const unsubscribe =
      subscribeShared(
        groupId,
        (data) => {

          setExpenses(
            data?.expenses || []
          );

        }
      );

    return () => unsubscribe();

  }, [groupId]);
  const persist = async (e) => {

    setExpenses(e);

    await saveShared(
      groupId,
      "expenses",
      e
    );

  };

  const addExpense  = (exp) => persist([{ ...exp, id: uid(), date: today(), settled: [] }, ...expenses]);
  const settle      = (id, memberId) => persist(expenses.map(e => e.id === id ? { ...e, settled: [...(e.settled||[]), memberId] } : e));
  const unsettle    = (id, memberId) => persist(expenses.map(e => e.id === id ? { ...e, settled: (e.settled||[]).filter(m => m !== memberId) } : e));
  const del         = (id) => { if(confirm("Delete this expense?")) persist(expenses.filter(e => e.id !== id)); };

  const balances = {};
  members.forEach(m => { balances[m.id] = 0; });
  expenses.forEach(exp => {
    const split = exp.participants || members.map(m => m.id);
    const per = exp.amount / split.length;
    balances[exp.paidBy] = (balances[exp.paidBy] || 0) + exp.amount;
    split.forEach(id => { balances[id] = (balances[id] || 0) - per; });
    (exp.settled || []).forEach(id => {
      if (id !== exp.paidBy) {
        balances[id] = (balances[id] || 0) + per;
        balances[exp.paidBy] = (balances[exp.paidBy] || 0) - per;
      }
    });
  });

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Expenses</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>
            <i className="ti ti-users" style={{ fontSize: 11, marginRight: 3 }} />Shared with group
          </p>
        </div>
        <button style={styles.primaryBtn} onClick={() => setModal(true)}>
          <i className="ti ti-plus" style={{ marginRight: 4 }} /> Add
        </button>
      </div>
      <div style={styles.filterRow}>
        <button style={{ ...styles.chip, ...(view === "balances" ? styles.chipActive : {}) }} onClick={() => setView("balances")}>Balances</button>
        <button style={{ ...styles.chip, ...(view === "history"  ? styles.chipActive : {}) }} onClick={() => setView("history")}>History</button>
      </div>

      {view === "balances" && members.map((m, i) => {
        const bal = balances[m.id] || 0;
        const pos = bal > 0.01, neg = bal < -0.01;
        const isMe = m.id === currentMemberId;
        return (
          <div key={m.id} style={{ ...styles.card, display: "flex", alignItems: "center", gap: 12, ...(isMe ? { border: "1.5px solid #7F77DD33" } : {}) }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: avatarColor(i), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>
              {m.name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 500 }}>{m.name}{isMe && <span style={{ fontSize: 11, color: "#7F77DD", marginLeft: 5 }}>(you)</span>}</p>
              <p style={{ margin: 0, fontSize: 12, color: pos ? "#1D9E75" : neg ? "#E24B4A" : "var(--color-text-secondary)" }}>
                {pos ? `Gets back ₹${Math.abs(bal).toFixed(2)}` : neg ? `Owes ₹${Math.abs(bal).toFixed(2)}` : "Settled up"}
              </p>
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: pos ? "#1D9E75" : neg ? "#E24B4A" : "var(--color-text-secondary)" }}>
              {pos ? "+" : ""}{bal.toFixed(0)}
            </span>
          </div>
        );
      })}

      {view === "history" && (
        <>
          {expenses.length === 0 && <Empty icon="ti-receipt" text="No expenses yet" />}
          {expenses.map(exp => (
            <ExpenseCard key={exp.id} expense={exp} members={members}
              onSettle={settle} onUnsettle={unsettle} onDelete={() => del(exp.id)} />
          ))}
        </>
      )}

      {modal && (
        <Modal title="Add expense" onClose={() => setModal(false)}>
          <ExpenseForm members={members} currentMemberId={currentMemberId}
            onSave={(e) => { addExpense(e); setModal(false); }} />
        </Modal>
      )}
    </div>
  );
}

function ExpenseCard({ expense, members, onSettle, onUnsettle, onDelete }) {
  const [open, setOpen] = useState(false);
  const paidBy     = members.find(m => m.id === expense.paidBy);
  const participants = (expense.participants || members.map(m => m.id)).map(id => members.find(m => m.id === id)).filter(Boolean);
  const perPerson  = (expense.amount / participants.length).toFixed(2);
  const settled    = expense.settled || [];
  const pending    = participants.filter(m => m.id !== expense.paidBy && !settled.includes(m.id)).length;

  return (
    <div style={styles.card}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontWeight: 500, fontSize: 15 }}>{expense.title}</p>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>₹{expense.amount}</p>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
            Paid by {paidBy?.name} · ₹{perPerson}/person
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <span style={styles.badgeNeutral}>{fmtDate(expense.date)}</span>
            {pending > 0 ? <span style={styles.badgeDanger}>{pending} pending</span> : <span style={styles.badgeSuccess}>All settled</span>}
          </div>
        </div>
        <button style={styles.iconBtn} onClick={() => setOpen(!open)}>
          <i className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 15 }} />
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
          {participants.filter(m => m.id !== expense.paidBy).map(m => {
            const isSettled = settled.includes(m.id);
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ flex: 1, fontSize: 14 }}>{m.name}</span>
                <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>₹{perPerson}</span>
                <button style={{ ...styles.chip, padding: "4px 10px", fontSize: 12, ...(isSettled ? { background: "#EAF3DE", border: "0.5px solid #1D9E75", color: "#3B6D11" } : {}) }}
                  onClick={() => isSettled ? onUnsettle(expense.id, m.id) : onSettle(expense.id, m.id)}>
                  {isSettled ? <><i className="ti ti-check" style={{ marginRight: 3 }} />Paid</> : "Mark paid"}
                </button>
              </div>
            );
          })}
          <button style={{ ...styles.outlineBtn, marginTop: 6, color: "#E24B4A", fontSize: 13 }} onClick={onDelete}>
            <i className="ti ti-trash" style={{ marginRight: 4 }} />Delete
          </button>
        </div>
      )}
    </div>
  );
}

function ExpenseForm({ members, currentMemberId, onSave }) {
  const [title,        setTitle]        = useState("");
  const [amount,       setAmount]       = useState("");
  const [paidBy,       setPaidBy]       = useState(currentMemberId || members[0]?.id || "");
  const [participants, setParticipants] = useState(members.map(m => m.id));

  const toggle = (id) => setParticipants(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const submit = () => {
    if (!title.trim() || !amount || !paidBy || participants.length === 0) return;
    onSave({ title: title.trim(), amount: parseFloat(amount), paidBy, participants });
  };

  return (
    <>
      <label style={styles.label}>Description *</label>
      <input style={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Dinner" autoFocus />
      <label style={styles.label}>Amount (₹) *</label>
      <input type="number" style={styles.input} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" min="0" />
      <label style={styles.label}>Paid by</label>
      <select style={styles.input} value={paidBy} onChange={e => setPaidBy(e.target.value)}>
        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <label style={styles.label}>Split between</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {members.map((m,i) => (
          <button key={m.id} style={{ ...styles.chip, ...(participants.includes(m.id) ? styles.chipActive : {}) }}
            onClick={() => toggle(m.id)}>{m.name}</button>
        ))}
      </div>
      {amount && participants.length > 0 && (
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>
          ₹{(parseFloat(amount||0)/participants.length).toFixed(2)} per person ({participants.length} people)
        </p>
      )}
      <button style={{ ...styles.primaryBtn, width: "100%" }} onClick={submit}>Add expense</button>
    </>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────
function QuickInput({ placeholder, onSave }) {
  const [val, setVal] = useState("");
  return (
    <>
      <input style={styles.input} value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} autoFocus
        onKeyDown={e => e.key === "Enter" && val.trim() && onSave(val.trim())} />
      <button style={{ ...styles.primaryBtn, width: "100%", marginTop: 4 }} onClick={() => val.trim() && onSave(val.trim())}>Add item</button>
    </>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modalBox}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{title}</h3>
          <button style={styles.iconBtn} onClick={onClose}><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-secondary)" }}>
      <i className={`ti ${icon}`} style={{ fontSize: 36, display: "block", marginBottom: 10, opacity: 0.35 }} />
      <p style={{ margin: 0, fontSize: 14 }}>{text}</p>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  shell:         { display: "flex", flexDirection: "column", height: "100vh", maxHeight: 800, background: "var(--color-background-tertiary)", position: "relative", overflow: "hidden" },
  topBar:        { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px 10px", background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)" },
  appName:       { fontSize: 20, fontWeight: 800, letterSpacing: -0.5 },
  memberPill:    { display: "flex", alignItems: "center", gap: 6, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 20, padding: "5px 10px", cursor: "pointer", fontSize: 13 },
  content:       { flex: 1, overflowY: "auto", paddingBottom: 8 },
  nav:           { display: "flex", background: "var(--color-background-primary)", borderTop: "0.5px solid var(--color-border-tertiary)" },
  navBtn:        { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 0", border: "none", background: "none", cursor: "pointer", color: "var(--color-text-secondary)", gap: 2 },
  navBtnActive:  { color: "#7F77DD" },
  page:          { padding: "16px 14px 28px" },
  pageHeader:    { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  pageTitle:     { fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.5 },
  sectionLabel:  { fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" },
  card:          { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "12px 14px", marginBottom: 10 },
  input:         { width: "100%", boxSizing: "border-box", marginBottom: 12 },
  label:         { display: "block", fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  primaryBtn:    { background: "#7F77DD", color: "#fff", border: "none", borderRadius: "var(--border-radius-md)", padding: "9px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  outlineBtn:    { background: "none", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", padding: "7px 14px", fontSize: 13, cursor: "pointer", color: "var(--color-text-primary)", display: "flex", alignItems: "center" },
  iconBtn:       { background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: 6, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" },
  chip:          { background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 20, padding: "6px 14px", fontSize: 13, cursor: "pointer", color: "var(--color-text-secondary)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" },
  chipActive:    { background: "#7F77DD22", border: "0.5px solid #7F77DD", color: "#7F77DD", fontWeight: 500 },
  filterRow:     { display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 2 },
  checkbox:      { width: 22, height: 22, borderRadius: 6, border: "1.5px solid var(--color-border-secondary)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" },
  checkboxDone:  { background: "#1D9E75", borderColor: "#1D9E75" },
  badgeDanger:   { background: "#FCEBEB", color: "#A32D2D", fontSize: 11, padding: "2px 8px", borderRadius: 20, display: "inline-flex", alignItems: "center" },
  badgeSuccess:  { background: "#EAF3DE", color: "#3B6D11", fontSize: 11, padding: "2px 8px", borderRadius: 20, display: "inline-flex", alignItems: "center" },
  badgeNeutral:  { background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", fontSize: 11, padding: "2px 8px", borderRadius: 20, display: "inline-flex", alignItems: "center" },
  badgeInfo:     { background: "#EEEDFE", color: "#534AB7", fontSize: 11, padding: "2px 8px", borderRadius: 20, display: "inline-flex", alignItems: "center" },
  modalOverlay:  { position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 },
  modalBox:      { background: "var(--color-background-primary)", borderRadius: "var(--border-radius-xl) var(--border-radius-xl) 0 0", padding: "20px 16px 32px", width: "100%", maxHeight: "82%", overflowY: "auto", boxSizing: "border-box" },
  center:        { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 200 },
  spinner:       { width: 28, height: 28, border: "2.5px solid var(--color-border-secondary)", borderTopColor: "#7F77DD", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  memberPickBtn: { display: "flex", alignItems: "center", gap: 12, width: "100%", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "12px 14px", marginBottom: 10, cursor: "pointer", textAlign: "left" },
};
