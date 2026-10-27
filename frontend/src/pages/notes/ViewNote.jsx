import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { notesApi } from '../../api/client';

const ViewNote = () => {
    const { id } = useParams();
    const [note, setNote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchFullNote = async () => {
            try {
                setNote(await notesApi.get(id));
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchFullNote();
    }, [id]);

    if (loading) return <div className="landingPage"><h1>Decrypting data stream...</h1></div>;
    if (error) return <div className="landingPage"><div className="error">Error: {error}</div></div>;

    return (
        <div className="landingPage">
            {/* Fine line link to fly back home safely */}
            <Link to="/note" className="actionButton" style={{ marginBottom: '3rem' }}>
                &larr; Back to Dashboard
            </Link>

            <article className="fullNoteContainer">
                <header className="fullNoteHeader">
                    <span className="techMeta">// RECORD_ID: {id}</span>
                    <h1>{note.notes_name}</h1>
                </header>
                
                {/* Outputs the entire infinite text without any cropping rules */}
                <div className="fullNoteBody">
                    {note.notes}
                </div>
            </article>
        </div>
    );
};

export default ViewNote;
