import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

// --- 型定義 ---
interface LogItem {
  id: string;
  date: string; // YYYY-MM-DD
  intake: number;
  burn: number;
}

interface DailySummary {
  date: string;
  totalIntake: number;
  totalBurn: number;
  balance: number;
}

// 🏆 換算アイテム（図鑑データ）
const TROPHIES = [
  { name: "バター1箱", weight: 200, icon: "🧈", desc: "料理にコクを出すカロリーの塊" },
  { name: "サッカーボール", weight: 450, icon: "⚽", desc: "意外と軽い？450g級の脂肪" },
  { name: "週刊少年ジャンプ", weight: 700, icon: "📕", desc: "持ち歩くと重いあの厚み" },
  { name: "水 1リットル", weight: 1000, icon: "💧", desc: "ついにキログラムの大台へ" },
  { name: "ノートPC", weight: 1500, icon: "💻", desc: "常に持ち運んでいた脂肪PC" },
  { name: "２リットル瓶", weight: 2000, icon: "🍾", desc: "パーティサイズの重さ" },
  { name: "新生児", weight: 3000, icon: "👶", desc: "命の重さを脂肪で感じる" },
  { name: "猫", weight: 4000, icon: "🐈", desc: "脂肪という名のペットを手放した" },
  { name: "米袋 (5kg)", weight: 5000, icon: "🌾", desc: "スーパーで買うと重いアレ" },
  { name: "ロードバイク", weight: 8000, icon: "🚴", desc: "高級自転車1台分の軽量化" },
  { name: "一斗缶", weight: 15000, icon: "🛢️", desc: "とんでもない量を燃やしました" },
];

// --- ユーティリティ関数 ---
const getTodayISO = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const loadFromStorage = (): LogItem[] => {
  try {
    const saved = localStorage.getItem('fat-tracker-logs');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("データ読み込みエラー:", e);
    return [];
  }
};

const FatBurnTracker = () => {
  // 画面切り替え用 state: 'home' | 'collection'
  const [view, setView] = useState<'home' | 'collection'>('home');

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [intakeStr, setIntakeStr] = useState<string>("");
  const [burnStr, setBurnStr] = useState<string>("");

  useEffect(() => {
    setLogs(loadFromStorage());
  }, []);

  useEffect(() => {
    localStorage.setItem('fat-tracker-logs', JSON.stringify(logs));
  }, [logs]);

  // --- データの集計処理 ---
  const { dailySummaries, totalBalance, streak } = useMemo(() => {
    const map = new Map<string, DailySummary>();
    
    logs.forEach(log => {
      if (!map.has(log.date)) {
        map.set(log.date, { date: log.date, totalIntake: 0, totalBurn: 0, balance: 0 });
      }
      const day = map.get(log.date)!;
      day.totalIntake += log.intake;
      day.totalBurn += log.burn;
      day.balance = day.totalIntake - day.totalBurn;
    });

    const sortedSummaries = Array.from(map.values()).sort((a, b) => 
      b.date.localeCompare(a.date)
    );

    const totalBal = sortedSummaries.reduce((acc, day) => acc + day.balance, 0);

    // 簡易ストリーク計算
    let currentStreak = 0;
    const today = getTodayISO();
    
    if (sortedSummaries.length > 0) {
      const latest = sortedSummaries[0];
      const daysDiff = (new Date(today).getTime() - new Date(latest.date).getTime()) / (1000 * 3600 * 24);
      
      if (daysDiff <= 1) {
        for (const day of sortedSummaries) {
          if (day.balance < 0) {
             currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    return { 
      dailySummaries: sortedSummaries, 
      totalBalance: totalBal,
      streak: currentStreak
    };
  }, [logs]);

  // グラフ用データ
  const chartData = useMemo(() => {
    const asc = [...dailySummaries].sort((a, b) => a.date.localeCompare(b.date));
    let cumKcal = 0; 
    return asc.map((d) => {
      const deficit = Math.max(0, -d.balance);
      cumKcal += deficit;
      return {
        date: d.date.slice(5),
        balance: d.balance,
        burnedFatG: (cumKcal / 7200) * 1000
      };
    });
  }, [dailySummaries]);

  // --- 共通計算 ---
  const burnedFatGrams = Math.max(0, (totalBalance / 7200) * -1000);
  const currentTrophy = [...TROPHIES].reverse().find(t => burnedFatGrams >= t.weight);
  const nextTrophy = TROPHIES.find(t => burnedFatGrams < t.weight);
  
  // プログレス計算
  let progressPercent = 0;
  if (nextTrophy) {
    const prevWeight = currentTrophy ? currentTrophy.weight : 0;
    const range = nextTrophy.weight - prevWeight;
    const current = burnedFatGrams - prevWeight;
    progressPercent = Math.min(100, Math.max(0, (current / range) * 100));
  } else {
    progressPercent = 100;
  }

  // --- アクション ---
  const addLog = () => {
    const inVal = parseInt(intakeStr, 10) || 0;
    const outVal = parseInt(burnStr, 10) || 0;
    if (inVal === 0 && outVal === 0) return;
    const newLog: LogItem = {
      id: Date.now().toString(),
      date: getTodayISO(),
      intake: inVal,
      burn: outVal
    };
    setLogs([newLog, ...logs]);
    setIntakeStr("");
    setBurnStr("");
  };

  const deleteDay = (targetDate: string) => {
    if (window.confirm(`${targetDate} の記録をすべて削除しますか？`)) {
      setLogs(logs.filter(log => log.date !== targetDate));
    }
  };

  // --- レンダリング: メイン画面 ---
  const renderHome = () => (
    <>
      {/* ステータス */}
      <div style={styles.statusBox}>
        <div style={styles.streakBadge}>
          🔥 {streak}日連続
        </div>
        {/* 図鑑ボタン（右上） */}
        <button 
          onClick={() => setView('collection')} 
          style={styles.collectionButton}
        >
          📖 図鑑を見る
        </button>

        <h3 style={{margin: '20px 0 0', color: '#555', fontSize: '14px'}}>トータル消失脂肪 (推定)</h3>
        <p style={styles.bigNumber}>
          {burnedFatGrams.toFixed(1)} <span style={{fontSize: '20px'}}>g</span>
        </p>
        
        <div style={styles.levelBox}>
          <div style={styles.currentLevel}>
            <span style={{fontSize: '30px'}}>{currentTrophy ? currentTrophy.icon : "🥚"}</span>
            <div style={{textAlign: 'left'}}>
              <div style={{fontSize: '12px', color: '#777'}}>達成！</div>
              <div style={{fontWeight: 'bold', color: '#333'}}>
                {currentTrophy ? currentTrophy.name : "Start"}
              </div>
            </div>
          </div>
          <div style={{fontSize: '20px', color: '#ccc'}}>▶</div>
          <div style={styles.nextLevel}>
            <span style={{fontSize: '30px', opacity: 0.5}}>{nextTrophy ? nextTrophy.icon : "👑"}</span>
            <div style={{textAlign: 'left'}}>
              <div style={{fontSize: '12px', color: '#777'}}>NEXT</div>
              <div style={{fontWeight: 'bold', color: '#333'}}>
                {nextTrophy ? nextTrophy.name : "Complete"}
              </div>
            </div>
          </div>
        </div>

        <div style={{marginTop: '15px'}}>
          <div style={styles.progressBarBg}>
            <div style={{...styles.progressBarFill, width: `${progressPercent}%`}}></div>
          </div>
          <p style={{fontSize: '12px', color: '#666', marginTop: '5px', textAlign: 'right'}}>
            あと {(nextTrophy ? nextTrophy.weight - burnedFatGrams : 0).toFixed(0)}g
          </p>
        </div>
      </div>

      {/* 入力フォーム */}
      <div style={styles.inputGroup}>
        <div style={styles.inputRow}>
          <label style={styles.label}>摂取 (in)</label>
          <input 
            type="number" 
            placeholder="例: 2000"
            value={intakeStr} 
            onChange={(e) => setIntakeStr(e.target.value)} 
            style={styles.input}
          />
        </div>
        <div style={styles.inputRow}>
          <label style={styles.label}>消費 (out)</label>
          <input 
            type="number" 
            placeholder="例: 2400"
            value={burnStr} 
            onChange={(e) => setBurnStr(e.target.value)} 
            style={styles.input}
          />
        </div>
        <button onClick={addLog} style={styles.button}>
          記録する (追記)
        </button>
      </div>

      {/* グラフ */}
      <div style={{ margin: '10px 0 24px' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: '#333' }}>推移グラフ</h3>
        <div style={{ width: '100%', height: 220, background: '#fff', borderRadius: 16, padding: '10px 10px 10px 0', border: '1px solid #eee', boxSizing: 'border-box' }}>
          {chartData.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', marginTop: 80 }}>データがありません</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  formatter={(value: any, name: any) => {
                    if (name === 'burnedFatG') return [`${Number(value).toFixed(1)} g`, '累積脂肪'];
                    if (name === 'balance') return [`${value} kcal`, '日次収支'];
                    return [value, name];
                  }}
                />
                <Area type="monotone" dataKey="balance" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 履歴リスト */}
      <h3 style={{borderBottom: '2px solid #eee', paddingBottom: '10px', fontSize: '16px'}}>日次レポート</h3>
      <ul style={styles.list}>
        {dailySummaries.length === 0 && <p style={{textAlign: 'center', color: '#999'}}>記録なし</p>}
        {dailySummaries.map((day) => (
          <li key={day.date} style={styles.listItem}>
            <div>
              <span style={{fontSize: '14px', fontWeight:'bold', color: '#333', display: 'block'}}>
                {day.date} <span style={{fontSize:'12px', fontWeight:'normal', color:'#888'}}>(計{day.totalIntake} - {day.totalBurn})</span>
              </span>
              <span style={{fontWeight: 'bold', color: day.balance > 0 ? '#e53e3e' : '#38a169'}}>
                収支: {day.balance > 0 ? `+${day.balance}` : day.balance} kcal
              </span>
            </div>
            <button onClick={() => deleteDay(day.date)} style={styles.deleteButton}>×</button>
          </li>
        ))}
      </ul>
    </>
  );

  // --- レンダリング: 図鑑画面 ---
  const renderCollection = () => (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => setView('home')} style={styles.backButton}>← 戻る</button>
        <h2 style={{ margin: '0 0 0 10px', fontSize: '18px', color: '#333' }}>燃焼図鑑コレクション</h2>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <p style={{ fontSize: '14px', color: '#666' }}>現在の総燃焼量</p>
        <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#0ea5e9', margin: '5px 0' }}>
          {burnedFatGrams.toFixed(1)} g
        </p>
      </div>

      <div style={styles.collectionGrid}>
        {TROPHIES.map((trophy, index) => {
          const isUnlocked = burnedFatGrams >= trophy.weight;
          return (
            <div 
              key={index} 
              style={{
                ...styles.collectionItem,
                opacity: isUnlocked ? 1 : 0.5,
                filter: isUnlocked ? 'none' : 'grayscale(100%)',
                border: isUnlocked ? '2px solid #0ea5e9' : '1px solid #eee',
                backgroundColor: isUnlocked ? '#f0f9ff' : '#f9fafb'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>{trophy.icon}</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{trophy.name}</div>
              <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 'bold', marginBottom: '4px' }}>
                {trophy.weight}g
              </div>
              <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
                {isUnlocked ? trophy.desc : "？？？"}
              </div>
              {isUnlocked && <div style={styles.unlockedBadge}>GET</div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🔥 脂肪燃焼トラッカー</h1>
        {view === 'home' ? renderHome() : renderCollection()}
      </div>
    </div>
  );
};

// --- スタイル ---
const styles: { [key: string]: React.CSSProperties } = {
  container: { minHeight: '100vh', width: '100vw', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' },
  card: { width: '100%', maxWidth: '420px', minHeight:'80vh', backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', padding: '24px', margin: '20px', position: 'relative' },
  title: { textAlign: 'center', margin: '0 0 20px 0', fontSize: '20px', color: '#333' },
  
  // Status Box
  statusBox: { background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', padding: '20px', borderRadius: '16px', marginBottom: '24px', textAlign: 'center', color: '#0c4a6e', position: 'relative' },
  streakBadge: { position: 'absolute', top: '10px', left: '10px', background: '#e53e3e', color: 'white', fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' },
  collectionButton: { position: 'absolute', top: '10px', right: '10px', background: '#fff', color: '#0ea5e9', border: 'none', fontSize: '12px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  
  bigNumber: { fontSize: '42px', fontWeight: '800', margin: '5px 0 15px', color: '#0284c7' },
  
  // Level Box
  levelBox: { background: 'rgba(255,255,255,0.6)', borderRadius: '12px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  currentLevel: { display: 'flex', alignItems: 'center', gap: '8px', opacity: 1 },
  nextLevel: { display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6 },
  
  // Progress Bar
  progressBarBg: { width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '4px', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#0284c7', transition: 'width 0.5s ease' },
  
  // Inputs
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' },
  inputRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  label: { width: '80px', fontSize: '14px', fontWeight: 'bold', color: '#555' },
  input: { flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #ddd', fontSize: '16px', outline: 'none' },
  button: { marginTop: '10px', padding: '14px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.4)' },
  
  // List
  list: { listStyle: 'none', padding: 0, margin: 0 },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' },
  deleteButton: { background: 'none', border: 'none', color: '#999', fontSize: '20px', cursor: 'pointer', padding: '0 10px' },

  // Collection (図鑑) Styles
  backButton: { background: 'none', border: 'none', color: '#666', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' },
  collectionGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  collectionItem: { padding: '15px', borderRadius: '12px', textAlign: 'center', position: 'relative', transition: 'all 0.3s ease' },
  unlockedBadge: { position: 'absolute', top: '5px', right: '5px', backgroundColor: '#fbbf24', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', transform: 'rotate(15deg)' }
};

export default FatBurnTracker;