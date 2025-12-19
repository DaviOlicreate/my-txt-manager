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
  AlertCircle
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
  onAuthStateChanged 
} from 'firebase/auth';

// --- CONFIGURAÇÃO DO SEU FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAvOICZLA1RFRDssU9XSRJhxVEDfp-TavA",
  authDomain: "produtividade-txt.firebaseapp.com",
  projectId: "produtividade-txt",
  storageBucket: "produtividade-txt.firebasestorage.app",
  messagingSenderId: "1008823595372",
  appId: "1:1008823595372:web:e2859447c5323c7062c349"
};

// Inicialização das instâncias
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const PROJECT_ID = 'my-txt-manager'; // ID fixo para sua organização no banco

export default function App() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [showAdminView, setShowAdminView] = useState(false);
  const [error, setError] = useState(null);

  // 1. Autenticação (Entra automaticamente de forma anônima)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Erro na autenticação:", err.code);
          if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
            setError("O login Anónimo não está ativado no Firebase. Vá a 'Authentication' -> 'Sign-in method' e ative 'Anónimo'.");
          } else {
            setError(`Erro de Autenticação: ${err.message}`);
          }
        }
      } else {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Sincronização em Tempo Real com Firestore
  useEffect(() => {
    if (!user) return;

    // Caminho onde os dados serão salvos no banco
    const filesRef = collection(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files');
    
    const unsubscribe = onSnapshot(filesRef, (snapshot) => {
      const filesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Ordena por data de atualização (mais novos primeiro)
      setFiles(filesData.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (err) => {
      console.error("Erro na sincronização:", err);
      if (err.code === 'permission-denied') {
        setError("Permissão negada no Firestore. Verifique se criou o banco de dados em 'Modo de Teste' ou se as regras permitem acesso.");
      }
    });

    return () => unsubscribe();
  }, [user]);

  const activeFile = files.find(f => f.id === activeFileId);

  // Criar novo arquivo
  const createNewFile = async (name, content = "") => {
    if (!user || !name) return;
    const fileId = crypto.randomUUID();
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', fileId);
    
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

  // Upload de arquivo local
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      createNewFile(file.name, e.target.result);
    };
    reader.readAsText(file);
  };

  // Atualizar conteúdo do texto
  const updateFileContent = async (content) => {
    if (!user || !activeFileId) return;
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    await updateDoc(fileRef, { 
      content, 
      updatedAt: Date.now() 
    });
  };

  // Excluir arquivo
  const deleteFile = async (id) => {
    if (!user) return;
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', id);
    await deleteDoc(fileRef);
    if (activeFileId === id) setActiveFileId(null);
  };

  // Gerenciar Tarefas (Checklist)
  const addTask = async () => {
    if (!newTaskText.trim() || !activeFile) return;
    const updatedTasks = [
      ...activeFile.tasks, 
      { id: crypto.randomUUID(), text: newTaskText, completed: false }
    ];
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    await updateDoc(fileRef, { tasks: updatedTasks, updatedAt: Date.now() });
    setNewTaskText('');
  };

  const toggleTask = async (taskId) => {
    if (!activeFile) return;
    const updatedTasks = activeFile.tasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    await updateDoc(fileRef, { tasks: updatedTasks, updatedAt: Date.now() });
  };

  const removeTask = async (taskId) => {
    if (!activeFile) return;
    const updatedTasks = activeFile.tasks.filter(t => t.id !== taskId);
    const fileRef = doc(db, 'app-data', PROJECT_ID, 'users', user.uid, 'files', activeFileId);
    await updateDoc(fileRef, { tasks: updatedTasks, updatedAt: Date.now() });
  };

  const completedLists = files.filter(f => f.tasks.length > 0 && f.tasks.every(t => t.completed));

  // Renderização de Erro Crítico
  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-red-100 max-w-lg">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-red-500" size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-4">Configuração Necessária</h2>
          <div className="bg-red-50/50 p-4 rounded-2xl mb-6 text-left border border-red-100">
            <p className="text-red-700 text-sm leading-relaxed font-medium">{error}</p>
          </div>
          <ol className="text-left text-xs text-slate-500 space-y-2 mb-8 list-decimal pl-4">
            <li>Aceda ao Firebase Console</li>
            <li>Vá a <strong>Build {'>'} Authentication</strong></li>
            <li>Ative o provedor <strong>Anonymous</strong></li>
            <li>Vá a <strong>Build {'>'} Firestore Database</strong> e crie o banco de dados em "Modo de Teste".</li>
          </ol>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg active:scale-95"
          >
            Recarregar Aplicação
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-indigo-600 animate-pulse font-medium flex items-center gap-2 text-lg">
          <Cloud size={24} /> Conectando ao Banco de Dados...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Barra Lateral */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h1 className="text-xl font-bold flex items-center gap-2 text-indigo-600">
            <FileText size={24} />
            TXT Manager
          </h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Cloud Sync Ativo</p>
        </div>

        <div className="p-4 flex flex-col gap-2">
          <button 
            onClick={() => { setShowNewFileDialog(true); setShowAdminView(false); }}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl transition-all shadow-md active:scale-95"
          >
            <Plus size={18} /> Novo Documento
          </button>
          
          <label className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-indigo-400 text-slate-600 py-2.5 px-4 rounded-xl transition-all cursor-pointer">
            <Upload size={18} /> Importar .txt
            <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 pt-0 space-y-1 custom-scrollbar">
          <div className="text-xs font-bold text-slate-400 px-2 py-3 uppercase tracking-wider">Meus Arquivos</div>
          {files.map(file => (
            <div 
              key={file.id}
              onClick={() => { setActiveFileId(file.id); setShowAdminView(false); }}
              className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                activeFileId === file.id && !showAdminView
                ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' 
                : 'hover:bg-slate-50 text-slate-600'
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
          {files.length === 0 && <p className="text-center text-xs text-slate-300 py-10 italic">Nenhum arquivo ainda.</p>}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={() => setShowAdminView(!showAdminView)}
            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all ${
              showAdminView ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Database size={14} /> {showAdminView ? 'Sair do Modo Dados' : 'Ver Dados do Firestore'}
          </button>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/30">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-tighter">
            <CheckCircle2 size={14} /> Concluídos ({completedLists.length})
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

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden">
        {showAdminView ? (
          <div className="flex-1 flex flex-col p-8 bg-slate-900 text-slate-300 overflow-hidden">
            <h2 className="text-xl font-bold text-white mb-4">Dados Brutos (JSON)</h2>
            <div className="flex-1 bg-black/40 rounded-2xl p-6 overflow-y-auto font-mono text-xs">
              <pre className="text-amber-200">{JSON.stringify(files, null, 2)}</pre>
            </div>
          </div>
        ) : activeFile ? (
          <>
            <header className="h-16 border-b border-slate-100 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-slate-800">{activeFile.name}</h2>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-2 py-1 bg-slate-50 rounded border border-slate-100">Sincronizado</span>
              </div>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
                  isEditing ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {isEditing ? <><Save size={16} /> Salvar Alterações</> : <><Edit3 size={16} /> Editar Texto</>}
              </button>
            </header>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col p-6 overflow-hidden border-r border-slate-50">
                {isEditing ? (
                  <textarea 
                    className="flex-1 w-full p-6 border border-slate-200 rounded-3xl bg-slate-50/30 focus:ring-4 focus:ring-indigo-50 outline-none resize-none font-mono text-slate-700 leading-relaxed transition-all"
                    value={activeFile.content}
                    onChange={(e) => updateFileContent(e.target.value)}
                  />
                ) : (
                  <div className="flex-1 w-full p-8 bg-white rounded-3xl overflow-y-auto border border-slate-100 whitespace-pre-wrap text-slate-700 font-mono text-sm leading-relaxed shadow-inner">
                    {activeFile.content || <span className="text-slate-300 italic">Vazio. Clique em Editar para começar.</span>}
                  </div>
                )}
              </div>

              <div className="w-96 bg-slate-50/50 p-6 flex flex-col overflow-hidden">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Checklist</h3>
                <div className="flex gap-2 mb-6">
                  <input 
                    type="text"
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none shadow-sm"
                    placeholder="Adicionar tarefa..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                  />
                  <button onClick={addTask} className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-md transition-all active:scale-95">
                    <Plus size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {activeFile.tasks.map(task => (
                    <div 
                      key={task.id}
                      className={`group flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                        task.completed ? 'bg-emerald-50/30 border-emerald-100 text-slate-400' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                      }`}
                    >
                      <button onClick={() => toggleTask(task.id)} className={`shrink-0 ${task.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-400'}`}>
                        {task.completed ? <CheckSquare size={22} /> : <Square size={22} />}
                      </button>
                      <span className={`flex-1 text-sm ${task.completed ? 'line-through' : 'font-medium'}`}>{task.text}</span>
                      <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center bg-slate-50/20">
            <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-slate-200/50">
              <Cloud size={48} className="text-indigo-200" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Cloud TXT Manager</h2>
            <p className="max-w-md text-sm text-slate-500 leading-relaxed">
              Todos os seus arquivos e listas de tarefas são salvos automaticamente no seu banco de dados privado. Escolha um arquivo para começar.
            </p>
          </div>
        )}
      </main>

      {/* Modal Novo Arquivo */}
      {showNewFileDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-black text-slate-800 mb-2 text-center">Novo TXT</h3>
            <p className="text-sm text-slate-500 mb-8 text-center leading-relaxed">Dê um nome ao seu documento. Ele será sincronizado instantaneamente.</p>
            <input 
              autoFocus
              type="text"
              className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-lg outline-none focus:ring-4 focus:ring-indigo-100 mb-8 transition-all"
              placeholder="Ex: Metas_2024.txt"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createNewFile(newFileName)}
            />
            <div className="flex gap-4">
              <button onClick={() => setShowNewFileDialog(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all">Cancelar</button>
              <button onClick={() => createNewFile(newFileName)} className="flex-1 py-4 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95">Criar Arquivo</button>
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
