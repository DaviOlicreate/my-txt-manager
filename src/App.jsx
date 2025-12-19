import React, { useState, useEffect } from 'react';

import { 

  FileText, 

  Plus, 

  Upload, 

  Trash2, 

  Save, 

  CheckSquare, 

  Square, 

  Edit3, 

  X,

  CheckCircle2,

  Clock,

  Cloud,

  Database,

  Eye

} from 'lucide-react';

import { initializeApp } from 'firebase/app';

import { 

  getFirestore, 

  collection, 

  doc, 

  setDoc, 

  onSnapshot, 

  deleteDoc, 

  updateDoc

} from 'firebase/firestore';

import { 

  getAuth, 

  signInAnonymously, 

  signInWithCustomToken, 

  onAuthStateChanged 

} from 'firebase/auth';



// Configuração do Firebase integrada

const firebaseConfig = {

  apiKey: "AIzaSyAvOICZLA1RFRDssU9XSRJhxVEDfp-TavA",

  authDomain: "produtividade-txt.firebaseapp.com",

  projectId: "produtividade-txt",

  storageBucket: "produtividade-txt.firebasestorage.app",

  messagingSenderId: "1008823595372",

  appId: "1:1008823595372:web:e2859447c5323c7062c349"

};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-txt-manager';



export default function App() {

  const [user, setUser] = useState(null);

  const [files, setFiles] = useState([]);

  const [activeFileId, setActiveFileId] = useState(null);

  const [isEditing, setIsEditing] = useState(false);

  const [newFileName, setNewFileName] = useState('');

  const [showNewFileDialog, setShowNewFileDialog] = useState(false);

  const [newTaskText, setNewTaskText] = useState('');

  const [showAdminView, setShowAdminView] = useState(false);



  // 1. Inicialização da Autenticação (Regra 3)

  useEffect(() => {

    const initAuth = async () => {

      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {

        await signInWithCustomToken(auth, __initial_auth_token);

      } else {

        await signInAnonymously(auth);

      }

    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, setUser);

    return () => unsubscribe();

  }, []);



  // 2. Sincronização de Dados em Tempo Real (Regra 1 e 2)

  useEffect(() => {

    if (!user) return;



    const filesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'files');

    

    const unsubscribe = onSnapshot(filesRef, (snapshot) => {

      const filesData = snapshot.docs.map(doc => ({

        id: doc.id,

        ...doc.data()

      }));

      setFiles(filesData.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));

    }, (error) => {

      console.error("Erro na sincronização:", error);

    });



    return () => unsubscribe();

  }, [user]);



  const activeFile = files.find(f => f.id === activeFileId);



  // Funções de Gestão de Ficheiros

  const createNewFile = async (name, content = "") => {

    if (!user || !name) return;

    const fileId = crypto.randomUUID();

    const fileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'files', fileId);

    

    await setDoc(fileRef, {

      name: name.endsWith('.txt') ? name : `${name}.txt`,

      content: content,

      tasks: [],

      createdAt: Date.now(),

      updatedAt: Date.now()

    });

    

    setActiveFileId(fileId);

    setShowNewFileDialog(false);

    setNewFileName('');

  };



  const handleFileUpload = (event) => {

    const file = event.target.files[0];

    if (!file) return;



    const reader = new FileReader();

    reader.onload = (e) => {

      createNewFile(file.name, e.target.result);

    };

    reader.readAsText(file);

  };



  const updateFileContent = async (content) => {

    if (!user || !activeFileId) return;

    const fileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'files', activeFileId);

    await updateDoc(fileRef, { 

      content, 

      updatedAt: Date.now() 

    });

  };



  const deleteFile = async (id) => {

    if (!user) return;

    const fileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'files', id);

    await deleteDoc(fileRef);

    if (activeFileId === id) setActiveFileId(null);

  };



  // Funções de Checklist

  const addTask = async () => {

    if (!newTaskText.trim() || !activeFile) return;

    const updatedTasks = [

      ...activeFile.tasks, 

      { id: crypto.randomUUID(), text: newTaskText, completed: false }

    ];

    const fileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'files', activeFileId);

    await updateDoc(fileRef, { tasks: updatedTasks, updatedAt: Date.now() });

    setNewTaskText('');

  };



  const toggleTask = async (taskId) => {

    if (!activeFile) return;

    const updatedTasks = activeFile.tasks.map(t => 

      t.id === taskId ? { ...t, completed: !t.completed } : t

    );

    const fileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'files', activeFileId);

    await updateDoc(fileRef, { tasks: updatedTasks, updatedAt: Date.now() });

  };



  const removeTask = async (taskId) => {

    if (!activeFile) return;

    const updatedTasks = activeFile.tasks.filter(t => t.id !== taskId);

    const fileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'files', activeFileId);

    await updateDoc(fileRef, { tasks: updatedTasks, updatedAt: Date.now() });

  };



  const completedLists = files.filter(f => f.tasks.length > 0 && f.tasks.every(t => t.completed));



  if (!user) {

    return (

      <div className="h-screen flex items-center justify-center bg-slate-50">

        <div className="text-indigo-600 animate-pulse font-medium flex items-center gap-2">

          <Cloud size={20} /> A ligar ao Firestore...

        </div>

      </div>

    );

  }



  return (

    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">

      {/* Sidebar */}

      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">

        <div className="p-6 border-b border-slate-100 bg-slate-50/50">

          <h1 className="text-xl font-bold flex items-center gap-2 text-indigo-600">

            <FileText size={24} />

            TXT Manager

          </h1>

          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Base de Dados Integrada</p>

        </div>



        <div className="p-4 flex flex-col gap-2">

          <button 

            onClick={() => { setShowNewFileDialog(true); setShowAdminView(false); }}

            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl transition-all shadow-sm hover:shadow-md"

          >

            <Plus size={18} /> Criar Novo TXT

          </button>

          

          <label className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-indigo-400 text-slate-600 py-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-sm">

            <Upload size={18} /> Carregar Arquivo

            <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />

          </label>

        </div>



        <nav className="flex-1 overflow-y-auto p-4 pt-0 space-y-1 custom-scrollbar">

          <div className="text-xs font-bold text-slate-400 px-2 py-3 uppercase">Meus Ficheiros</div>

          {files.map(file => (

            <div 

              key={file.id}

              onClick={() => { setActiveFileId(file.id); setShowAdminView(false); }}

              className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${

                activeFileId === file.id && !showAdminView

                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 

                : 'hover:bg-slate-100 text-slate-600'

              }`}

            >

              <div className="flex items-center gap-3 overflow-hidden">

                <FileText size={18} className={activeFileId === file.id ? 'text-indigo-500' : 'text-slate-400'} />

                <span className="truncate font-medium text-sm">{file.name}</span>

              </div>

              <button 

                onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}

                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"

              >

                <Trash2 size={14} />

              </button>

            </div>

          ))}

        </nav>



        {/* Botão de Acesso aos Dados (Modo Admin) */}

        <div className="p-4 border-t border-slate-100">

          <button 

            onClick={() => setShowAdminView(!showAdminView)}

            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all ${

              showAdminView 

              ? 'bg-amber-100 text-amber-700' 

              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'

            }`}

          >

            <Database size={14} /> {showAdminView ? 'Fechar Modo Admin' : 'Aceder aos Dados Crus'}

          </button>

        </div>



        {/* Resumo de Checklists Completas */}

        <div className="p-4 border-t border-slate-100 bg-slate-50/30">

          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-tighter">

            <CheckCircle2 size={14} /> Checklists Finalizadas ({completedLists.length})

          </div>

          <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">

            {completedLists.map(list => (

              <div key={list.id} className="text-xs flex items-center gap-2 text-emerald-600 font-medium bg-emerald-50 p-2 rounded-lg border border-emerald-100">

                <CheckCircle2 size={12} />

                <span className="truncate">{list.name}</span>

              </div>

            ))}

          </div>

        </div>

      </aside>



      {/* Main Content */}

      <main className="flex-1 flex flex-col bg-white overflow-hidden">

        {showAdminView ? (

          /* Visualização de Admin (Firestore Raw Data) */

          <div className="flex-1 flex flex-col p-8 bg-slate-900 text-slate-300 overflow-hidden">

            <div className="flex items-center justify-between mb-6">

              <div>

                <h2 className="text-xl font-bold text-white flex items-center gap-2">

                  <Database className="text-amber-500" /> Explorador do Firestore

                </h2>

                <p className="text-xs text-slate-500 mt-1">Caminho: artifacts/{appId}/users/{user.uid}/files</p>

              </div>

              <div className="text-[10px] bg-slate-800 px-3 py-1 rounded-full border border-slate-700 text-slate-400">

                LIGAÇÃO ACTIVA

              </div>

            </div>

            <div className="flex-1 bg-black/40 rounded-2xl border border-slate-800 p-6 overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed">

              <div className="text-emerald-500 mb-4">// Dados estruturados em tempo real</div>

              <pre className="text-amber-200">

                {JSON.stringify(files, null, 2)}

              </pre>

            </div>

          </div>

        ) : activeFile ? (

          /* Visualização Normal */

          <>

            <header className="h-16 border-b border-slate-100 px-6 flex items-center justify-between shrink-0">

              <div className="flex items-center gap-4">

                <h2 className="text-lg font-semibold text-slate-800">{activeFile.name}</h2>

                <span className="text-xs text-slate-400 flex items-center gap-1">

                  <Clock size={12} />

                  Salvo às {new Date(activeFile.updatedAt).toLocaleTimeString()}

                </span>

              </div>

              <div className="flex items-center gap-3">

                <button 

                  onClick={() => setIsEditing(!isEditing)}

                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${

                    isEditing 

                    ? 'bg-indigo-600 text-white shadow-indigo-200' 

                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'

                  }`}

                >

                  {isEditing ? <><Save size={16} /> Gravar</> : <><Edit3 size={16} /> Editar Texto</>}

                </button>

              </div>

            </header>



            <div className="flex-1 flex overflow-hidden">

              <div className="flex-1 flex flex-col p-6 overflow-hidden border-r border-slate-50">

                <div className="mb-3 flex items-center justify-between">

                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Conteúdo</h3>

                </div>

                {isEditing ? (

                  <textarea 

                    className="flex-1 w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none resize-none font-mono text-slate-700 transition-all"

                    value={activeFile.content}

                    onChange={(e) => updateFileContent(e.target.value)}

                  />

                ) : (

                  <div className="flex-1 w-full p-6 bg-slate-50/50 rounded-2xl overflow-y-auto border border-slate-100 whitespace-pre-wrap text-slate-700 font-mono text-sm leading-relaxed">

                    {activeFile.content || <span className="text-slate-300 italic font-sans text-base">Vazio. Clique em Editar para começar.</span>}

                  </div>

                )}

              </div>



              <div className="w-96 bg-slate-50/30 p-6 flex flex-col overflow-hidden">

                <div className="mb-6">

                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">

                    <CheckSquare size={16} className="text-indigo-400" /> Tarefas

                  </h3>

                  <div className="flex gap-2">

                    <input 

                      type="text"

                      className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none"

                      placeholder="Nova tarefa..."

                      value={newTaskText}

                      onChange={(e) => setNewTaskText(e.target.value)}

                      onKeyDown={(e) => e.key === 'Enter' && addTask()}

                    />

                    <button onClick={addTask} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">

                      <Plus size={20} />

                    </button>

                  </div>

                </div>



                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">

                  {activeFile.tasks.map(task => (

                    <div 

                      key={task.id}

                      className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${

                        task.completed ? 'bg-emerald-50/50 border-emerald-100 text-slate-400' : 'bg-white border-slate-100 text-slate-700'

                      }`}

                    >

                      <button onClick={() => toggleTask(task.id)} className={`shrink-0 ${task.completed ? 'text-emerald-500' : 'text-slate-300'}`}>

                        {task.completed ? <CheckSquare size={20} /> : <Square size={20} />}

                      </button>

                      <span className={`flex-1 text-sm ${task.completed ? 'line-through' : 'font-medium'}`}>{task.text}</span>

                      <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"><X size={14} /></button>

                    </div>

                  ))}

                </div>

              </div>

            </div>

          </>

        ) : (

          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center bg-slate-50/20">

            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm">

              <Cloud size={40} className="text-indigo-200" />

            </div>

            <h2 className="text-2xl font-bold text-slate-800 mb-2">Seu Gerenciador TXT</h2>

            <p className="max-w-md text-sm text-slate-500">

              Escolha um ficheiro ou crie um novo para começar. Todos os dados são sincronizados com o Firestore.

            </p>

          </div>

        )}

      </main>



      {/* Modal Novo Ficheiro */}

      {showNewFileDialog && (

        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">

          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">

            <h3 className="text-xl font-bold text-slate-800 mb-4">Novo TXT</h3>

            <input 

              autoFocus

              type="text"

              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg outline-none mb-6"

              placeholder="Nome do ficheiro..."

              value={newFileName}

              onChange={(e) => setNewFileName(e.target.value)}

              onKeyDown={(e) => e.key === 'Enter' && createNewFile(newFileName)}

            />

            <div className="flex gap-3">

              <button onClick={() => setShowNewFileDialog(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-all">Cancelar</button>

              <button onClick={() => createNewFile(newFileName)} className="flex-1 py-3 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-2xl transition-all shadow-lg">Criar</button>

            </div>

          </div>

        </div>

      )}



      <style dangerouslySetInnerHTML={{ __html: `

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }

        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }

      `}} />

    </div>

  );

}