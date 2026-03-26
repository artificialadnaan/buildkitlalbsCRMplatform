import { useState, useEffect } from 'react';
import { portalApi } from '../lib/api.js';

interface Survey {
  id: string;
  projectId: string;
  milestoneId: string;
  milestoneName: string;
  rating: number | null;
  comment: string | null;
  sentAt: string;
  respondedAt: string | null;
}

export default function Surveys() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    portalApi<Survey[]>('/api/portal/surveys')
      .then(setSurveys)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const submitSurvey = async (surveyId: string) => {
    const rating = selectedRating[surveyId];
    if (!rating) return;

    setSubmitting(surveyId);
    try {
      await portalApi(`/api/portal/surveys/${surveyId}`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment: comments[surveyId] || null }),
      });
      setSurveys(prev =>
        prev.map(s => s.id === surveyId ? { ...s, rating, comment: comments[surveyId] || null, respondedAt: new Date().toISOString() } : s)
      );
    } catch (err) {
      console.error('Failed to submit survey:', err);
    } finally {
      setSubmitting(null);
    }
  };

  const pending = surveys.filter(s => !s.respondedAt);
  const completed = surveys.filter(s => s.respondedAt);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading surveys...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-200">Satisfaction Surveys</h1>
        <p className="text-sm text-gray-500 mt-1">Help us improve by rating completed milestones</p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase">Pending Feedback</h2>
          {pending.map(survey => (
            <div key={survey.id} className="bg-sidebar border border-border rounded-lg p-6">
              <h3 className="text-base font-medium text-gray-200 mb-1">{survey.milestoneName}</h3>
              <p className="text-sm text-gray-500 mb-4">
                Completed {new Date(survey.sentAt).toLocaleDateString()}
              </p>

              <p className="text-sm text-gray-300 mb-3">How satisfied are you with this milestone?</p>

              <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setSelectedRating(prev => ({ ...prev, [survey.id]: star }))}
                    className={`w-10 h-10 rounded-lg text-lg transition ${
                      (selectedRating[survey.id] || 0) >= star
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {star}
                  </button>
                ))}
              </div>

              <textarea
                placeholder="Optional comment..."
                value={comments[survey.id] || ''}
                onChange={e => setComments(prev => ({ ...prev, [survey.id]: e.target.value }))}
                className="w-full bg-gray-800 border border-border rounded-md px-3 py-2 text-sm text-gray-300 placeholder-gray-600 resize-none mb-3"
                rows={2}
              />

              <button
                onClick={() => submitSurvey(survey.id)}
                disabled={!selectedRating[survey.id] || submitting === survey.id}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting === survey.id ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase">Completed</h2>
          {completed.map(survey => (
            <div key={survey.id} className="bg-sidebar border border-border rounded-lg p-4 opacity-75">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-300">{survey.milestoneName}</h3>
                  <p className="text-xs text-gray-500">
                    Rated {survey.rating}/5 on {new Date(survey.respondedAt!).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className={star <= (survey.rating || 0) ? 'text-yellow-500' : 'text-gray-600'}>
                      ★
                    </span>
                  ))}
                </div>
              </div>
              {survey.comment && (
                <p className="text-sm text-gray-400 mt-2 italic">"{survey.comment}"</p>
              )}
            </div>
          ))}
        </div>
      )}

      {surveys.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No surveys yet</p>
          <p className="text-sm mt-1">Surveys will appear here after milestones are completed</p>
        </div>
      )}
    </div>
  );
}
