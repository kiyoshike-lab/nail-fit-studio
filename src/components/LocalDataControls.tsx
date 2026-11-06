"use client";
import { useState } from "react";
import { clearLocalAppData } from "@/lib/localDataControls";
export function LocalDataControls(){
  const [confirm,setConfirm]=useState(""),[notice,setNotice]=useState("");
  return <details className="panel-card local-data-controls"><summary>この端末の保存データを管理</summary><p>自作デザイン・下書き・お気に入り・履歴・調整値・カメラ選択を、このブラウザから削除します。他のサイトのデータは削除しません。この操作は取り消せません。</p><label>削除する場合は「削除」と入力<input autoComplete="off" maxLength={2} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button type="button" className="secondary" disabled={confirm!=="削除"} onClick={()=>{let result;try{result=clearLocalAppData(window.localStorage);}catch{result={ok:false,removed:0};}setConfirm("");setNotice(result.ok?`このブラウザのデータを削除しました（${result.removed}件）。一覧は再読み込みすると更新されます。`:`削除を完了できませんでした（削除済み${result.removed}件）。ブラウザの保存設定を確認してください。`);}}>端末内データの削除を確定</button>{notice&&<p role="status">{notice}</p>}</details>;
}
