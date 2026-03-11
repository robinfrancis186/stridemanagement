import { useState, useRef, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { STATES, type StateKey } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar, Plus, Trophy, ArrowRight, Upload, Loader2, CheckCircle2 } from "lucide-react";

interface DesignathonEvent {
  id: string;
  title: string;
  description: string | null;
  status: string;
  requirement_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface Team {
  id: string;
  event_id: string;
  requirement_id: string | null;
  team_name: string;
  members: string[];
  submission_url: string | null;
  score: number | null;
  is_winner?: boolean;
}

interface Requirement {
  id: string;
  title: string;
  current_state: string;
}

const DesignathonManagement = () => {
  const { role, user } = useAuth();
  const isAdmin = role === "coe_admin";
  const [events, setEvents] = useState<DesignathonEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Action State
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [winnersModalOpen, setWinnersModalOpen] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  // Forms
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [numWinners, setNumWinners] = useState("3");

  // AI & Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadAction, setUploadAction] = useState<"REGISTRATION" | "JUDGING" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusText, setStatusText] = useState("");

  const fetchData = async () => {
    try {
      const [evSnap, tmSnap, rqSnap] = await Promise.all([
        getDocs(query(collection(db, "designathon_events"), orderBy("created_at", "desc"))),
        getDocs(query(collection(db, "designathon_teams"), orderBy("created_at", "asc"))),
        getDocs(collection(db, "requirements")),
      ]);

      setEvents(evSnap.docs.map(d => ({ id: d.id, ...d.data() })) as DesignathonEvent[]);
      setTeams(tmSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Team[]);
      const allReqs = rqSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Requirement[];
      setRequirements(allReqs);
    } catch (error) {
      console.error("Failed to load designathon data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const advanceReqState = async (reqId: string, newState: string) => {
    const oldState = requirements.find(r => r.id === reqId)?.current_state;
    await updateDoc(doc(db, "requirements", reqId), { current_state: newState });

    if (oldState) {
      await Promise.all([
        addDoc(collection(db, "state_transitions"), {
          requirement_id: reqId,
          from_state: oldState,
          to_state: newState,
          notes: `Advanced via Designathon Event Workflow`,
          transitioned_by: user?.uid || null,
          created_at: new Date().toISOString()
        }),
        addDoc(collection(db, "phase_feedbacks"), {
          requirement_id: reqId,
          from_state: oldState,
          to_state: newState,
          phase_notes: "Auto-generated from Designathon Action",
          created_at: new Date().toISOString()
        })
      ]);
    }
  };

  const handleCreateEvent = async () => {
    try {
      setActionLoading(true);
      // 1. Create the associated Requirement
      const reqRef = await addDoc(collection(db, "requirements"), {
        title: `Designathon: ${eventTitle}`,
        description: eventDesc || "Auto-generated requirement for Designathon tracking.",
        source_type: "OTHER",
        priority: "P2",
        tech_level: "MEDIUM",
        current_state: "H-DES-1",
        created_by: user?.uid || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Log the initial state
      await addDoc(collection(db, "state_transitions"), {
        requirement_id: reqRef.id,
        from_state: "NEW",
        to_state: "H-DES-1",
        notes: "Designathon Event Created",
        transitioned_by: user?.uid || null,
        created_at: new Date().toISOString()
      });

      // 2. Create the Event
      await addDoc(collection(db, "designathon_events"), {
        title: eventTitle,
        description: eventDesc || null,
        requirement_id: reqRef.id,
        status: "active",
        created_at: new Date().toISOString()
      });

      toast({ title: "Event Created & Challenge Published" });
      setEventModalOpen(false);
      setEventTitle("");
      setEventDesc("");
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeEventId || !uploadAction) return;

    setActionLoading(true);
    setStatusText("Reading Excel File...");

    try {
      // Lazy load XLSX
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const csvData = XLSX.utils.sheet_to_csv(firstSheet);

      if (!csvData || csvData.length < 10) throw new Error("Excel file appears to be empty.");

      setStatusText("Parsing with AI...");
      const { getGeminiModel } = await import("@/lib/gemini");
      const model = getGeminiModel();

      const event = events.find(e => e.id === activeEventId);
      if (!event || !event.requirement_id) throw new Error("Event or requirement not found");

      if (uploadAction === "REGISTRATION") {
        const prompt = `You are an AI assistant helping to parse Designathon Team Registration data from a raw, noisy CSV file.
Extract all the teams mentioned. Expected output should be valid JSON in this exact structure:
{
  "teams": [
    { "team_name": "Team A", "members": ["Alice", "Bob"] }
  ]
}
Do not include any other markdown or text outside the JSON. Extract as many teams as you can find.

Raw CSV Data:
${csvData.slice(0, 15000)}`;

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        });

        setStatusText("Saving Teams...");
        const parsed = JSON.parse(result.response.text());
        const extractedTeams = parsed.teams || [];

        if (extractedTeams.length === 0) throw new Error("AI could not find any teams in the file.");

        // Bulk insert
        const promises = extractedTeams.map((t: any) =>
          addDoc(collection(db, "designathon_teams"), {
            event_id: activeEventId,
            requirement_id: event.requirement_id,
            team_name: String(t.team_name || "Unknown Team"),
            members: Array.isArray(t.members) ? t.members.map(String) : [],
            score: null,
            submission_url: null,
            is_winner: false,
            created_at: new Date().toISOString()
          })
        );
        await Promise.all(promises);

        // Auto-advance
        await advanceReqState(event.requirement_id, "H-DES-2");
        toast({ title: `Successfully registered ${extractedTeams.length} teams.` });

      } else if (uploadAction === "JUDGING") {
        const prompt = `You are an AI parsing Judging/Scores data for a Designathon from a raw CSV file.
Extract team names and their final numerical scores. Expected output format:
{
  "scores": [
    { "team_name": "Team A", "score": 85 }
  ]
}

Raw CSV Data:
${csvData.slice(0, 15000)}`;

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        });

        setStatusText("Updating Scores...");
        const parsed = JSON.parse(result.response.text());
        const extractedScores = parsed.scores || [];

        const eventTeams = teams.filter(t => t.event_id === activeEventId);
        let updatedCount = 0;

        const promises = extractedScores.map(async (es: any) => {
          // Fuzzy match team name
          const match = eventTeams.find(t => t.team_name.toLowerCase().includes(String(es.team_name).toLowerCase()));
          if (match && es.score !== undefined && es.score !== null) {
            updatedCount++;
            return updateDoc(doc(db, "designathon_teams", match.id), { score: Number(es.score) });
          }
        });
        await Promise.all(promises);

        // Auto-advance
        await advanceReqState(event.requirement_id, "H-DES-4");
        toast({ title: `Updated scores for ${updatedCount} teams.` });
      }

      fetchData();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Upload Failed", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setStatusText("");
      setUploadAction(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerUpload = (eventId: string, action: "REGISTRATION" | "JUDGING") => {
    setActiveEventId(eventId);
    setUploadAction(action);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleCloseRegistration = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event || !event.requirement_id) return;
    if (!confirm("Close registrations and move to Submissions In phase?")) return;

    setActionLoading(true);
    try {
      await advanceReqState(event.requirement_id, "H-DES-3");
      toast({ title: "Registration Closed" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectWinners = async () => {
    if (!activeEventId) return;
    setActionLoading(true);
    try {
      const event = events.find(e => e.id === activeEventId);
      if (!event || !event.requirement_id) throw new Error("Event/Req not found");

      const eventTeams = teams.filter(t => t.event_id === activeEventId);
      const limit = parseInt(numWinners, 10);
      if (isNaN(limit) || limit <= 0) throw new Error("Invalid number of winners");

      const sorted = [...eventTeams].sort((a, b) => (b.score || 0) - (a.score || 0));
      const winners = sorted.slice(0, limit);

      const promises = winners.map(w => updateDoc(doc(db, "designathon_teams", w.id), { is_winner: true }));
      await Promise.all(promises);

      await advanceReqState(event.requirement_id, "H-DES-5");
      toast({ title: `${winners.length} Winners Selected!` });
      setWinnersModalOpen(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteHandover = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event || !event.requirement_id) return;
    if (!confirm("Finalize process and push to Prototype Handover?")) return;

    setActionLoading(true);
    try {
      await advanceReqState(event.requirement_id, "H-DES-6");
      toast({ title: "Event Completed!" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const desStates = ["H-DES-1", "H-DES-2", "H-DES-3", "H-DES-4", "H-DES-5", "H-DES-6"];

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Hidden File Input for Excel */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx, .xls, .csv"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Global Processing Overlay */}
      {actionLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 bg-card p-6 rounded-lg shadow-xl border">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-medium text-lg">{statusText || "Processing Action..."}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Designathon Automation</h1>
          <p className="text-sm text-muted-foreground">AI-assisted batch processing for events</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setEventModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Event
          </Button>
        )}
      </div>

      {/* Pipeline Tracker */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="font-display text-base">Pipeline Tracker</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {desStates.map((state, i) => {
              const info = STATES[state as StateKey];
              const count = requirements.filter(r => r.current_state === state).length;
              return (
                <div key={state} className="flex items-center">
                  <div className={`rounded-lg border px-3 py-2 text-center min-w-[100px] ${count > 0 ? "border-accent bg-accent/10" : "border-border"}`}>
                    <p className="text-[10px] font-medium text-muted-foreground">{state}</p>
                    <p className="text-xs font-medium">{info?.label}</p>
                    <p className="text-lg font-bold font-display text-foreground">{count}</p>
                  </div>
                  {i < desStates.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      {events.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            No designathon events active.
          </CardContent>
        </Card>
      ) : (
        events.map(ev => {
          const evTeams = teams.filter(t => t.event_id === ev.id);
          const req = ev.requirement_id ? requirements.find(r => r.id === ev.requirement_id) : null;
          const currentState = req?.current_state || "H-DES-1";

          return (
            <Card key={ev.id} className="shadow-card border-l-4 border-l-accent overflow-hidden">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-accent" />
                      {ev.title}
                    </CardTitle>
                    {ev.description && <p className="text-sm text-muted-foreground mt-1">{ev.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">{currentState}</Badge>
                      <span className="text-xs text-muted-foreground">{STATES[currentState as StateKey]?.label}</span>
                    </div>
                  </div>

                  {/* Contextual Action Buttons based on Pipeline State */}
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {currentState === "H-DES-1" && (
                        <Button onClick={() => triggerUpload(ev.id, "REGISTRATION")} className="shadow-sm">
                          <Upload className="mr-2 h-4 w-4" /> Upload Registration Excel
                        </Button>
                      )}

                      {currentState === "H-DES-2" && (
                        <Button onClick={() => handleCloseRegistration(ev.id)} variant="default">
                          Close Registrations
                        </Button>
                      )}

                      {currentState === "H-DES-3" && (
                        <Button onClick={() => triggerUpload(ev.id, "JUDGING")} className="shadow-sm" variant="secondary">
                          <Upload className="mr-2 h-4 w-4" /> Upload Judging Excel
                        </Button>
                      )}

                      {currentState === "H-DES-4" && (
                        <Button onClick={() => { setActiveEventId(ev.id); setWinnersModalOpen(true); }} className="bg-accent text-accent-foreground hover:bg-accent/90">
                          Select Winners
                        </Button>
                      )}

                      {currentState === "H-DES-5" && (
                        <Button onClick={() => handleCompleteHandover(ev.id)} variant="default">
                          Approve Prototypes
                        </Button>
                      )}

                      {currentState === "H-DES-6" && (
                        <Badge variant="default" className="bg-success text-success-foreground px-3 py-1 text-sm border-0">
                          <CheckCircle2 className="mr-1 h-4 w-4 inline" /> Completed
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {evTeams.length > 0 ? (
                  <div>
                    <div className="flex justify-between items-end mb-3">
                      <p className="text-sm font-semibold text-foreground">Registered Teams ({evTeams.length})</p>
                    </div>
                    <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                      {evTeams.map(t => (
                        <div key={t.id} className={`rounded border p-3 text-sm transition-colors ${t.is_winner ? 'border-accent bg-accent/10 shadow-sm' : 'bg-card'}`}>
                          <div className="flex justify-between items-start">
                            <p className="font-semibold text-foreground">{t.team_name}</p>
                            {t.is_winner && <Trophy className="h-4 w-4 text-accent" />}
                          </div>
                          {t.members.length > 0 && <p className="text-xs text-muted-foreground mt-1 line-clamp-1 truncate">{t.members.join(", ")}</p>}
                          {t.score !== null && (
                            <div className="mt-3 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-secondary-foreground">
                              Score: {t.score}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-center text-muted-foreground py-4">No teams registered yet. Upload an Excel file to extract teams via AI.</p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Create Event Modal */}
      <Dialog open={eventModalOpen} onOpenChange={setEventModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Create Designathon Event</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} className="mt-1" rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateEvent} disabled={!eventTitle.trim() || actionLoading}>{actionLoading ? "Creating..." : "Create & Publish"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Winners Modal */}
      <Dialog open={winnersModalOpen} onOpenChange={setWinnersModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Select Final Winners</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Number of Winners (Top N)</Label>
            <Input type="number" min="1" max="50" value={numWinners} onChange={e => setNumWinners(e.target.value)} />
            <p className="text-xs text-muted-foreground">The AI extracted scores will be used to automatically select the top {numWinners} teams.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWinnersModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSelectWinners} disabled={!numWinners || actionLoading}>{actionLoading ? "Processing..." : "Confirm Winners"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default DesignathonManagement;
