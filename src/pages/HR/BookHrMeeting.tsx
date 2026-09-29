import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarDays,
  Clock,
  Video,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

type MeetingType = "in_person" | "online";

interface BookingDetails {
  employee_name: string;
  warning_type: string;
  warning_date: string;
  meeting_status: string | null;
}

export default function BookHRMeeting() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [details, setDetails] =
    useState<BookingDetails | null>(null);

  const [meetingDate, setMeetingDate] = useState("");
  const [meetingStartTime, setMeetingStartTime] = useState("");
  const [meetingType, setMeetingType] =
    useState<MeetingType>("in_person");
  const [meetingMessage, setMeetingMessage] = useState("");

  // ==========================================================
  // LOAD BOOKING DETAILS
  // ==========================================================

  useEffect(() => {
    const loadBookingDetails = async () => {
      if (!token) {
        setError(
          "This meeting booking link is invalid or missing its security token."
        );
        setLoading(false);
        return;
      }

      try {
        const { data, error: functionError } =
          await supabase.functions.invoke(
            "fms-hr-meeting",
            {
              body: {
                operation: "get_booking",
                token,
              },
            }
          );

        if (functionError) {
          console.error(
            "Booking function error:",
            functionError
          );

          setError(
            "Unable to load the meeting booking page. Please try again."
          );

          setLoading(false);
          return;
        }

        if (!data?.success) {
          setError(
            data?.error ||
              "This booking link is invalid or has expired."
          );

          setLoading(false);
          return;
        }

        setDetails(data.booking);
      } catch (err) {
        console.error(
          "Unexpected booking error:",
          err
        );

        setError(
          "Something went wrong while loading the booking page."
        );
      } finally {
        setLoading(false);
      }
    };

    loadBookingDetails();
  }, [token]);

  // ==========================================================
  // BOOK MEETING
  // ==========================================================

  const handleBooking = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setError("");

    if (!token) {
      setError("This booking link is invalid.");
      return;
    }

    if (!meetingDate) {
      setError("Please select a meeting date.");
      return;
    }

    if (!meetingStartTime) {
      setError("Please select a meeting time.");
      return;
    }

    try {
      setBooking(true);

      const { data, error: functionError } =
        await supabase.functions.invoke(
          "fms-hr-meeting",
          {
            body: {
              operation: "book_meeting",
              token,
              meeting_date: meetingDate,
              meeting_start_time:
                meetingStartTime,
              meeting_type: meetingType,
              meeting_message:
                meetingMessage.trim() || null,
            },
          }
        );

      if (functionError) {
        console.error(
          "Booking function error:",
          functionError
        );

        setError(
          "Unable to book the meeting. Please try again."
        );

        return;
      }

      if (!data?.success) {
        setError(
          data?.error ||
            "Unable to book the meeting."
        );

        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error(
        "Unexpected booking error:",
        err
      );

      setError(
        "Something went wrong while booking the meeting."
      );
    } finally {
      setBooking(false);
    }
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-700" />

          <p className="text-sm text-slate-600">
            Loading your meeting booking...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error && !details) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">

          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-7 w-7 text-red-600" />
          </div>

          <h1 className="text-xl font-semibold text-slate-900 mb-3">
            Unable to Open Booking
          </h1>

          <p className="text-sm text-slate-600 leading-6">
            {error}
          </p>

        </div>
      </div>
    );
  }

  // ==========================================================
  // SUCCESS
  // ==========================================================

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">

          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>

          <h1 className="text-2xl font-semibold text-slate-900 mb-3">
            Meeting Request Submitted
          </h1>

          <p className="text-sm text-slate-600 leading-6 mb-6">
            Your request to meet with HR has been submitted
            successfully.
          </p>

          <div className="bg-slate-50 rounded-xl p-5 text-left">

            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
              Meeting details
            </p>

            <div className="space-y-3 text-sm text-slate-700">

              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <span>{meetingDate}</span>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-slate-500" />
                <span>{meetingStartTime}</span>
              </div>

              <div className="flex items-center gap-3">
                {meetingType === "online" ? (
                  <Video className="h-4 w-4 text-slate-500" />
                ) : (
                  <Building2 className="h-4 w-4 text-slate-500" />
                )}

                <span>
                  {meetingType === "online"
                    ? "Online meeting"
                    : "In-person meeting"}
                </span>
              </div>

            </div>
          </div>

          <p className="text-xs text-slate-500 mt-6">
            HR will review your request and confirm the
            meeting arrangements.
          </p>

        </div>
      </div>
    );
  }

  // ==========================================================
  // BOOKING PAGE
  // ==========================================================

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">

      <div className="max-w-2xl mx-auto">

        {/* HEADER */}

        <div className="text-center mb-8">

          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-slate-900 mb-4">
            <CalendarDays className="h-7 w-7 text-white" />
          </div>

          <h1 className="text-2xl font-semibold text-slate-900">
            Book a Meeting with HR
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Request a meeting with the HR department to
            discuss your warning.
          </p>

        </div>

        {/* MAIN CARD */}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

          {/* WARNING INFORMATION */}

          <div className="p-6 border-b border-slate-200">

            <h2 className="text-base font-semibold text-slate-900 mb-4">
              Warning Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>
                <p className="text-xs text-slate-500 mb-1">
                  Employee
                </p>

                <p className="text-sm font-medium text-slate-900">
                  {details?.employee_name}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">
                  Warning type
                </p>

                <p className="text-sm font-medium text-slate-900">
                  {details?.warning_type}
                </p>
              </div>

            </div>

          </div>

          {/* FORM */}

          <form
            onSubmit={handleBooking}
            className="p-6 space-y-6"
          >

            {/* ERROR */}

            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">

                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />

                <p className="text-sm text-red-700">
                  {error}
                </p>

              </div>
            )}

            {/* DATE */}

            <div>

              <label
                htmlFor="meeting-date"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Meeting date
              </label>

              <div className="relative">

                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />

                <input
                  id="meeting-date"
                  type="date"
                  value={meetingDate}
                  onChange={(e) =>
                    setMeetingDate(e.target.value)
                  }
                  min={
                    new Date()
                      .toISOString()
                      .split("T")[0]
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-10 py-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />

              </div>

            </div>

            {/* TIME */}

            <div>

              <label
                htmlFor="meeting-time"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Preferred time
              </label>

              <div className="relative">

                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />

                <input
                  id="meeting-time"
                  type="time"
                  value={meetingStartTime}
                  onChange={(e) =>
                    setMeetingStartTime(e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-10 py-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />

              </div>

            </div>

            {/* MEETING TYPE */}

            <div>

              <label className="block text-sm font-medium text-slate-700 mb-3">
                Meeting type
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* IN PERSON */}

                <button
                  type="button"
                  onClick={() =>
                    setMeetingType("in_person")
                  }
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                    meetingType === "in_person"
                      ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >

                  <Building2 className="h-5 w-5 text-slate-700" />

                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      In-person
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      Meet with HR in person
                    </p>
                  </div>

                </button>

                {/* ONLINE */}

                <button
                  type="button"
                  onClick={() =>
                    setMeetingType("online")
                  }
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                    meetingType === "online"
                      ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >

                  <Video className="h-5 w-5 text-slate-700" />

                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Online
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      Meet with HR online
                    </p>
                  </div>

                </button>

              </div>

            </div>

            {/* MESSAGE */}

            <div>

              <label
                htmlFor="meeting-message"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Message to HR
                <span className="text-slate-400 font-normal">
                  {" "}
                  (optional)
                </span>
              </label>

              <textarea
                id="meeting-message"
                value={meetingMessage}
                onChange={(e) =>
                  setMeetingMessage(e.target.value)
                }
                rows={4}
                placeholder="You can provide a short message about what you would like to discuss..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />

            </div>

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={booking}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >

              {booking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting request...
                </>
              ) : (
                <>
                  <CalendarDays className="h-4 w-4" />
                  Request Meeting
                </>
              )}

            </button>

          </form>

        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Maharaja Spices HR Department
        </p>

      </div>

    </div>
  );
}