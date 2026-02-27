import { useState, useRef, useEffect } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, deleteObject, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Upload, FileIcon, Trash2, Download, File } from "lucide-react";

interface FileRecord {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

const FileUploadZone = ({ requirementId, isAdmin }: { requirementId: string; isAdmin: boolean }) => {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    const snap = await getDocs(query(
      collection(db, "requirement_files"),
      where("requirement_id", "==", requirementId),
      orderBy("created_at", "desc")
    ));
    setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })) as FileRecord[]);
  };

  useEffect(() => { fetchFiles(); }, [requirementId]);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);

    for (const file of Array.from(fileList)) {
      const filePath = `${requirementId}/${Date.now()}-${file.name}`;
      try {
        const fileRef = storageRef(storage, `requirement-files/${filePath}`);
        await uploadBytes(fileRef, file);

        await addDoc(collection(db, "requirement_files"), {
          requirement_id: requirementId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user?.uid,
          created_at: new Date().toISOString()
        });
      } catch (uploadErr: any) {
        toast({ title: "Upload Error", description: uploadErr.message, variant: "destructive" });
        continue;
      }
    }

    toast({ title: "Files Uploaded" });
    fetchFiles();
    setUploading(false);
  };

  const handleDelete = async (file: FileRecord) => {
    try {
      const fileRef = storageRef(storage, `requirement-files/${file.file_path}`);
      await deleteObject(fileRef);
      await deleteDoc(doc(db, "requirement_files", file.id));
    } catch (e: any) {
      toast({ title: "Error deleting file", description: e.message, variant: "destructive" });
    }
    toast({ title: "File Deleted" });
    fetchFiles();
  };

  const handleDownload = async (file: FileRecord) => {
    try {
      const fileRef = storageRef(storage, `requirement-files/${file.file_path}`);
      const url = await getDownloadURL(fileRef);
      if (url) window.open(url, "_blank");
    } catch (e: any) {
      toast({ title: "Error downloading file", description: e.message, variant: "destructive" });
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-sm flex items-center gap-2">
          <FileIcon className="h-4 w-4 text-primary" />
          Attachments ({files.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdmin && (
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {uploading ? "Uploading..." : "Drag & drop files or click to browse"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">PDF, images, STL, STEP files supported</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
              accept=".pdf,.png,.jpg,.jpeg,.gif,.stl,.step,.stp,.doc,.docx"
            />
          </div>
        )}

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                <File className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{f.file_name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatSize(f.file_size)} · {f.file_type || "unknown"}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(f)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(f)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {files.length === 0 && !isAdmin && (
          <p className="text-sm text-muted-foreground text-center py-2">No files attached.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default FileUploadZone;
