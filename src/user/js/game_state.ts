import { BlindTestQuestion, parse } from 'ani-grenoble-games-format/dist/QuestionTypes'
import { GameState } from 'ani-grenoble-games-format/dist/GameState'
import { ipcRenderer } from 'electron';

function escape(s: string): string {
    var tagsToReplace: Map<String, string> = new Map([
        ['&', '&amp;'],
        ['<', '&lt;'],
        ['>', '&gt;']
    ]);
    return s.replace(/[&<>]/g, (tag) => {
        return tagsToReplace.get(tag) || tag;
    });
};

ipcRenderer.on('game-state-data', (_, s) => {
    console.log("rezfzefzefz");
    const state: GameState = s;

    const xhttp = new XMLHttpRequest();
    xhttp.onloadend = function() {
        document.getElementById('game-state-div')!.innerHTML = this.responseText;
        var team_template: HTMLTemplateElement = document.getElementById('team-template') as HTMLTemplateElement;
        for (const player of state.players) {
            const clone = document.importNode(team_template.content, true);
            clone.getElementById("team-template-name")!.textContent = player.name;
            clone.getElementById("team-template-score")!.textContent = player.score.toString();
            document.getElementById('teams')?.appendChild(clone);
        }
    }
    xhttp.open("GET", "/html/state.html", true);
    xhttp.send();
});
