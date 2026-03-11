import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, addDoc } from "firebase/firestore";
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
import { Calendar, Plus, Users, Trophy, ArrowRight } from "lucide-react";

interface DesignathonEvent {
  id: string;
  title: string;
  description: string | null;
  status: string;
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
  const { role } = useAuth();
  const isAdmin = role === "coe_admin";
  const [events, setEvents] = useState<DesignathonEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Forms
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamMembers, setTeamMembers] = useState("");

  const fetchData = async () => {
    try {
      const [evSnap, tmSnap, rqSnap] = await Promise.all([
        getDocs(query(collection(db, "designathon_events"), orderBy("created_at", "desc"))),
        getDocs(query(collection(db, "designathon_teams"), orderBy("created_at", "asc"))),
        getDocs(collection(db, "requirements")), // filter client-side since 'like' is not supported easily
      ]);

      setEvents(evSnap.docs.map(d => ({ id: d.id, ...d.data() })) as DesignathonEvent[]);
      setTeams(tmSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Team[]);
      const allReqs = rqSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Requirement[];
      setRequirements(allReqs.filter(r => r.current_state?.startsWith("H-DES-")));
    } catch (error) {
      console.error("Failed to load designathon data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateEvent = async () => {
    try {
      await addDoc(collection(db, "designathon_events"), {
        title: eventTitle,
        description: eventDesc || null,
        status: "active",
        created_at: new Date().toISOString()
      });
      toast({ title: "Event Created" });
      setEventModalOpen(false);
      setEventTitle("");
      setEventDesc("");
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAddTeam = async () => {
    if (!selectedEventId) return;
    try {
      await addDoc(collection(db, "designathon_teams"), {
        event_id: selectedEventId,
        team_name: teamName,
        members: teamMembers.split(",").map(m => m.trim()).filter(Boolean),
        score: null,
        requirement_id: null,
        submission_url: null,
        is_winner: false,
        created_at: new Date().toISOString()
      });
      toast({ title: "Team Added" });
      setTeamModalOpen(false);
      setTeamName("");
      setTeamMembers("");
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // --- New Team Action Modals ---
  const [assignReqModalOpen, setAssignReqModalOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);

  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [selectedReqId, setSelectedReqId] = useState("");
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [teamScore, setTeamScore] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const getTeamAndReq = (teamId: string) => {
    const t = teams.find(x => x.id === teamId);
    const r = t?.requirement_id ? requirements.find(x => x.id === t.requirement_id) : null;
    return { t, r };
  };

  const advanceReqState = async (reqId: string, newState: string) => {
    import("firebase/firestore").then(async ({ doc, updateDoc, collection, addDoc }) => {
      const oldState = requirements.find(r => r.id === reqId)?.current_state;
      await updateDoc(doc(db, "requirements", reqId), { current_state: newState });

      // Add empty transition and feedback to keep timeline clean
      if (oldState) {
        await Promise.all([
          addDoc(collection(db, "state_transitions"), {
            requirement_id: reqId,
            from_state: oldState,
            to_state: newState,
            notes: `Auto-advanced via Designathon interface`,
            created_at: new Date().toISOString()
          }),
          addDoc(collection(db, "phase_feedbacks"), {
            requirement_id: reqId,
            from_state: oldState,
            to_state: newState,
            phase_notes: "Auto-generated from Team Action",
            created_at: new Date().toISOString()
          })
        ]);
      }
    });
  };

  const handleAssignReq = async () => {
    if (!activeTeamId || !selectedReqId) return;
    setActionLoading(true);
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, "designathon_teams", activeTeamId), { requirement_id: selectedReqId });

      // Auto advance the req to H-DES-2 (Teams Registered) if it is in H-DES-1
      const req = requirements.find(r => r.id === selectedReqId);
      if (req?.current_state === "H-DES-1") {
        await advanceReqState(selectedReqId, "H-DES-2");
      }

      toast({ title: "Requirement Assigned" });
      setAssignReqModalOpen(false);
      setSelectedReqId("");
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitUrl = async () => {
    if (!activeTeamId || !submissionUrl) return;
    setActionLoading(true);
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, "designathon_teams", activeTeamId), { submission_url: submissionUrl });

      // Auto advance the req to H-DES-3 (Submissions In)
      const { r } = getTeamAndReq(activeTeamId);
      if (r?.current_state === "H-DES-2") {
        await advanceReqState(r.id, "H-DES-3");
      }

      toast({ title: "Submission Recorded" });
      setSubmitModalOpen(false);
      setSubmissionUrl("");
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleScoreTeam = async () => {
    if (!activeTeamId || !teamScore) return;
    setActionLoading(true);
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, "designathon_teams", activeTeamId), { score: Number(teamScore) });

      // Auto advance IF all teams for this requirement have scores
      // (Simplified: Just advance it to H-DES-4 for now upon scoring)
      const { r } = getTeamAndReq(activeTeamId);
      if (r?.current_state === "H-DES-3") {
        await advanceReqState(r.id, "H-DES-4");
      }

      toast({ title: "Score Saved" });
      setScoreModalOpen(false);
      setTeamScore("");
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectWinner = async (teamId: string) => {
    if (!confirm("Select this team as the winner?")) return;
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, "designathon_teams", teamId), { is_winner: true });

      const { r } = getTeamAndReq(teamId);
      if (r?.current_state === "H-DES-4" || r?.current_state === "H-DES-3") {
        await advanceReqState(r.id, "H-DES-5");
      }

      toast({ title: "Winner Selected" });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleHandover = async (teamId: string) => {
    if (!confirm("Confirm prototype handover is complete?")) return;
    try {
      const { r } = getTeamAndReq(teamId);
      if (r) {
        await advanceReqState(r.id, "H-DES-6");
        toast({ title: "Handover Complete" });
        fetchData();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const desStates = ["H-DES-1", "H-DES-2", "H-DES-3", "H-DES-4", "H-DES-5", "H-DES-6"];

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Designathon Management</h1>
          <p className="text-sm text-muted-foreground">Active events, teams, and sub-state tracking</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setEventModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Event
          </Button>
        )}
      </div>

      {/* Sub-state Tracker */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="font-display text-base">Designathon Pipeline</CardTitle></CardHeader>
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

      {/* Events */}
      {events.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            No designathon events yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        events.map(ev => {
          const evTeams = teams.filter(t => t.event_id === ev.id);
          return (
            <Card key={ev.id} className="shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-accent" />
                    {ev.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={ev.status === "active" ? "default" : "secondary"}>{ev.status}</Badge>
                    {isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => { setSelectedEventId(ev.id); setTeamModalOpen(true); }}>
                        <Users className="mr-1 h-3 w-3" /> Add Team
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {ev.description && <p className="text-sm text-muted-foreground">{ev.description}</p>}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Created {format(new Date(ev.created_at), "PP")}
                </div>

                {evTeams.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <p className="text-xs font-medium text-muted-foreground">Teams ({evTeams.length})</p>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {evTeams.map(t => {
                        const reqForTeam = t.requirement_id ? requirements.find(r => r.id === t.requirement_id) : null;
                        return (
                          <div key={t.id} className={`rounded border p-3 text-sm flex flex-col justify-between ${t.is_winner ? 'border-accent bg-accent/5' : ''}`}>
                            <div>
                              <div className="flex justify-between items-start mb-1">
                                <p className="font-semibold">{t.team_name} {t.is_winner && <Trophy className="inline h-3 w-3 text-accent ml-1" />}</p>
                                {t.score !== null && (
                                  <Badge variant="secondary" className="text-[10px]">Score: {t.score}</Badge>
                                )}
                              </div>
                              {t.members && t.members.length > 0 && (
                                <p className="text-xs text-muted-foreground line-clamp-1">{t.members.join(", ")}</p>
                              )}

                              <div className="mt-2 space-y-1">
                                {reqForTeam ? (
                                  <div className="text-[11px] bg-muted/50 p-1.5 rounded">
                                    <span className="font-medium">Req: </span>
                                    <span className="text-muted-foreground">{reqForTeam.title}</span>
                                    <Badge variant="outline" className="ml-2 text-[9px] h-4 leading-none">{reqForTeam.current_state}</Badge>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-muted-foreground italic">No requirement assigned</p>
                                )}

                                {t.submission_url && (
                                  <div className="text-[11px] pt-1">
                                    <a href={t.submission_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                      View Submission
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            {isAdmin && (
                              <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t">
                                {!t.requirement_id && (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => { setActiveTeamId(t.id); setAssignReqModalOpen(true); }}>Assign Req</Button>
                                )}
                                {t.requirement_id && !t.submission_url && (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => { setActiveTeamId(t.id); setSubmitModalOpen(true); }}>Add Submission</Button>
                                )}
                                {t.submission_url && t.score === null && (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => { setActiveTeamId(t.id); setScoreModalOpen(true); }}>Score</Button>
                                )}
                                {t.score !== null && !t.is_winner && (
                                  <Button size="sm" variant="default" className="h-6 text-[10px] px-2" onClick={() => handleSelectWinner(t.id)}>Select Winner</Button>
                                )}
                                {t.is_winner && reqForTeam?.current_state === "H-DES-5" && (
                                  <Button size="sm" variant="default" className="h-6 text-[10px] px-2" onClick={() => handleHandover(t.id)}>Complete Handover</Button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
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
            <Button onClick={handleCreateEvent} disabled={!eventTitle.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Team Modal */}
      <Dialog open={teamModalOpen} onOpenChange={setTeamModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Team</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Team Name</Label><Input value={teamName} onChange={e => setTeamName(e.target.value)} className="mt-1" /></div>
            <div><Label>Members (comma-separated)</Label><Input value={teamMembers} onChange={e => setTeamMembers(e.target.value)} className="mt-1" placeholder="Alice, Bob, Charlie" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTeam} disabled={!teamName.trim()}>Add Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Requirement Modal */}
      <Dialog open={assignReqModalOpen} onOpenChange={setAssignReqModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Assign Requirement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Select Requirement</Label>
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedReqId}
              onChange={(e) => setSelectedReqId(e.target.value)}
            >
              <option value="" disabled>Select a requirement...</option>
              {requirements.filter(r => r.current_state === 'H-DES-1').map(r => (
                <option key={r.id} value={r.id}>{r.title} ({r.current_state})</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Only requirements in <strong>H-DES-1 (Challenge Published)</strong> are shown.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignReqModalOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button onClick={handleAssignReq} disabled={!selectedReqId || actionLoading}>{actionLoading ? "Assigning..." : "Assign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Modal */}
      <Dialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Submission</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Submission URL</Label>
            <Input value={submissionUrl} onChange={e => setSubmissionUrl(e.target.value)} placeholder="https://..." />
            <p className="text-xs text-muted-foreground">This will advance the requirement to <strong>H-DES-3 (Submissions In)</strong>.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitModalOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button onClick={handleSubmitUrl} disabled={!submissionUrl.trim() || actionLoading}>{actionLoading ? "Saving..." : "Save Submission"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Score Modal */}
      <Dialog open={scoreModalOpen} onOpenChange={setScoreModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Score Submission</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Score (0-100)</Label>
            <Input type="number" min="0" max="100" value={teamScore} onChange={e => setTeamScore(e.target.value)} />
            <p className="text-xs text-muted-foreground">This will advance the requirement to <strong>H-DES-4 (Judging Complete)</strong>.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoreModalOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button onClick={handleScoreTeam} disabled={!teamScore || actionLoading}>{actionLoading ? "Saving..." : "Save Score"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default DesignathonManagement;
